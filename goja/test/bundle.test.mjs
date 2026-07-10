// Smoke + wiring test for goja/bundle.js.
//
// Runs the built bundle in an isolated node:vm context with a MOCK __db (the
// same contract the Go host implements) and asserts the dispatch surface:
// tenant gate, route table, validation, and that a valid mutation issues the
// expected INSERT through the bridge. Real SQL round-trips are proven by the
// hanzoai/cloud integration (curl against Base); this guards the JS logic.
//
// Run: node goja/test/bundle.test.mjs   (or: npm --prefix goja test)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "bundle.js"), "utf8");

// A mock __db that records calls and returns scripted rows. `plan` maps a
// substring of the SQL to the rows/result the mock should return.
function makeDb(plan = {}) {
  const calls = [];
  const match = (sql) =>
    Object.keys(plan).find((k) => sql.replace(/\s+/g, " ").includes(k));
  return {
    calls,
    db: {
      query(sql, args) {
        calls.push({ kind: "query", sql, args });
        const k = match(sql);
        return k ? plan[k] : [];
      },
      exec(sql, args) {
        calls.push({ kind: "exec", sql, args });
        return { changes: 1, lastId: "x" };
      },
    },
  };
}

function runBundle(dbImpl) {
  let n = 0;
  const ctx = {
    __db: dbImpl,
    __newId: () => `id_${++n}`,
    __now: () => 1_700_000_000_000,
    JSON,
    Math,
    RegExp,
    Number,
    String,
    Array,
    Object,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.handle;
}

let passed = 0;
const it = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

// 1. Missing tenant → 401.
it("missing orgId → 401", () => {
  const handle = runBundle(makeDb().db);
  const res = handle({ route: "stakeholders.list", orgId: "" });
  assert.equal(res.status, 401);
});

// 2. Unknown route → 404 (the bundle's OWN 404, not a proxy).
it("unknown route → 404", () => {
  const handle = runBundle(makeDb().db);
  const res = handle({ route: "does.not.exist", orgId: "acme" });
  assert.equal(res.status, 404);
  assert.match(res.body.message, /unknown captable route/);
});

// 3. Validation runs before any DB write → 400 with field errors.
it("addStakeholders invalid body → 400", () => {
  const { db, calls } = makeDb();
  const handle = runBundle(db);
  const res = handle({
    route: "stakeholders.add",
    orgId: "acme",
    body: { name: "", email: "not-an-email", stakeholderType: "NOPE" },
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.length >= 2, "expected multiple field errors");
  assert.equal(
    calls.filter((c) => c.kind === "exec").length,
    0,
    "no write on invalid input",
  );
});

// 4. Valid stakeholder → 201 and issues one INSERT with the right columns/args.
it("addStakeholders valid → 201 + INSERT", () => {
  const { db, calls } = makeDb(); // query() returns [] → no duplicate
  const handle = runBundle(db);
  const res = handle({
    route: "stakeholders.add",
    orgId: "acme",
    body: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      stakeholderType: "INDIVIDUAL",
      currentRelationship: "FOUNDER",
    },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.inserted, 1);
  const insert = calls.find(
    (c) => c.kind === "exec" && c.sql.includes("INSERT INTO stakeholder"),
  );
  assert.ok(insert, "expected an INSERT INTO stakeholder");
  assert.equal(insert.args[1], "acme"); // company_id == tenant
  assert.equal(insert.args[3], "ada@example.com"); // email column
});

// 5. Share class create auto-increments idx from the per-company count.
it("createShareClass computes idx = count + 1", () => {
  const { db, calls } = makeDb({ "COUNT(*) AS n FROM share_class": [{ n: 2 }] });
  const handle = runBundle(db);
  const res = handle({
    route: "shareClasses.create",
    orgId: "acme",
    body: {
      name: "Series A Preferred",
      classType: "PREFERRED",
      initialSharesAuthorized: 1000000,
      boardApprovalDate: "2026-01-01",
      stockholderApprovalDate: "2026-01-02",
      votesPerShare: 1,
      parValue: 0.0001,
      pricePerShare: 1.25,
      seniority: 1,
      conversionRights: "CONVERTS_TO_FUTURE_ROUND",
      convertsToShareClassId: null,
      liquidationPreferenceMultiple: 1,
      participationCapMultiple: 0,
    },
  });
  assert.equal(res.status, 201);
  const insert = calls.find(
    (c) => c.kind === "exec" && c.sql.includes("INSERT INTO share_class"),
  );
  assert.ok(insert);
  assert.equal(insert.args[2], 3, "idx should be count(2) + 1"); // idx column
  assert.equal(insert.args[5], "PS", "PREFERRED → prefix PS"); // prefix column
});

// 6. capTable returns the computed shape (real SQL round-trips are proven in the
// cloud integration with a live SQLite; here we assert dispatch + shape with a
// mock that yields a company row and zero equity).
it("capTable → 200 with totals + sections", () => {
  const { db } = makeDb({ "FROM company WHERE id": [{ id: "acme", name: "Acme" }] });
  const handle = runBundle(db);
  const res = handle({ route: "captable", orgId: "acme" });
  assert.equal(res.status, 200);
  assert.equal(res.body.company.id, "acme");
  assert.ok("outstandingShares" in res.body.totals);
  assert.ok("fullyDilutedShares" in res.body.totals);
  assert.ok(res.body.convertibles && res.body.rounds);
});

// 7. Full share transfer reassigns the certificate (one UPDATE, no new share).
it("shares.transfer full → 200 + UPDATE stakeholder_id", () => {
  const { db, calls } = makeDb({
    // source share lookup, then the recipient existence check.
    "FROM share WHERE company_id = ? AND id = ?": [
      { id: "sh1", stakeholderId: "s1", shareClassId: "c1", quantity: 100, status: "ACTIVE", certificateId: "CS-1" },
    ],
    "SELECT 1 FROM stakeholder WHERE company_id = ? AND id = ?": [{ 1: 1 }],
  });
  const handle = runBundle(db);
  const res = handle({
    route: "shares.transfer",
    orgId: "acme",
    body: { shareId: "sh1", toStakeholderId: "s2" }, // no quantity → full
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.transferred, 100);
  assert.equal(res.body.newShareId, null);
  const upd = calls.find(
    (c) => c.kind === "exec" && c.sql.includes("UPDATE share SET stakeholder_id"),
  );
  assert.ok(upd, "expected an UPDATE reassigning the certificate");
  assert.equal(upd.args[0], "s2");
});

// 8. addOption validation gate (missing refs/fields) → 400 before any write.
it("options.add invalid → 400", () => {
  const { db, calls } = makeDb();
  const handle = runBundle(db);
  const res = handle({ route: "options.add", orgId: "acme", body: { grantId: "" } });
  assert.equal(res.status, 400);
  assert.equal(calls.filter((c) => c.kind === "exec").length, 0);
});

// 9. rounds.create PRICED requires a share class + price.
it("rounds.create PRICED without shareClassId → 400", () => {
  const { db } = makeDb();
  const handle = runBundle(db);
  const res = handle({
    route: "rounds.create",
    orgId: "acme",
    body: { name: "Seed", roundType: "PRICED", targetAmount: 1000000 },
  });
  assert.equal(res.status, 400);
});

console.log(`\n${passed} passed`);
