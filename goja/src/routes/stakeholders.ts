// Stakeholders — port of src/trpc/routers/stakeholder-router.

import { db, newId, now } from "../host";
import { asObj, badReq, type Ctx, created, notFound, okRes, type Res } from "./common";
import * as v from "../validate";

export function listStakeholders(ctx: Ctx): Res {
  const rows = db.query(
    `SELECT s.id, s.name, s.email, s.institution_name AS institutionName,
            s.stakeholder_type AS stakeholderType,
            s.current_relationship AS currentRelationship,
            s.tax_id AS taxId, s.street_address AS streetAddress, s.city,
            s.state, s.zipcode, s.country, s.created_at AS createdAt,
            c.name AS companyName
       FROM stakeholder s
       JOIN company c ON c.id = s.company_id
      WHERE s.company_id = ?
      ORDER BY s.created_at DESC`,
    [ctx.companyId],
  );
  return okRes(rows);
}

function validateStakeholder(o: Record<string, unknown>, errs: string[]) {
  return {
    name: v.reqString(o, "name", errs),
    email: v.email(o, "email", errs),
    institutionName: v.optString(o, "institutionName"),
    stakeholderType: v.oneOf(o, "stakeholderType", v.StakeholderType, errs),
    currentRelationship: v.oneOf(
      o,
      "currentRelationship",
      v.StakeholderRelationship,
      errs,
    ),
    taxId: v.optString(o, "taxId"),
    streetAddress: v.optString(o, "streetAddress"),
    city: v.optString(o, "city"),
    state: v.optString(o, "state"),
    zipcode: v.optString(o, "zipcode"),
  };
}

// POST /stakeholders — single object OR array (tRPC addStakeholders takes an
// array). Faithful: createMany with skipDuplicates on (company_id, email).
export function addStakeholders(ctx: Ctx): Res {
  const raw = ctx.body;
  const list = Array.isArray(raw) ? raw : [raw];
  if (list.length === 0) return badReq(["at least one stakeholder is required"]);

  const errs: string[] = [];
  const parsed = list.map((item) =>
    validateStakeholder(asObj(item), errs),
  );
  if (errs.length) return badReq(errs);

  const ts = now();
  let inserted = 0;
  for (const s of parsed) {
    const dup = db.query(
      `SELECT 1 FROM stakeholder WHERE company_id = ? AND email = ?`,
      [ctx.companyId, s.email],
    );
    if (dup.length > 0) continue; // skipDuplicates
    db.exec(
      `INSERT INTO stakeholder
         (id, company_id, name, email, institution_name, stakeholder_type,
          current_relationship, tax_id, street_address, city, state, zipcode,
          country, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        newId(),
        ctx.companyId,
        s.name,
        s.email,
        s.institutionName,
        s.stakeholderType,
        s.currentRelationship,
        s.taxId,
        s.streetAddress,
        s.city,
        s.state,
        s.zipcode,
        "US",
        ts,
        ts,
      ],
    );
    inserted += 1;
  }
  return created({
    success: true,
    message: "Stakeholders added successfully!",
    inserted,
  });
}

export function updateStakeholder(ctx: Ctx): Res {
  const id = ctx.params.id;
  if (!id) return badReq(["stakeholder id is required"]);
  const o = asObj(ctx.body);

  // Partial update (ZodUpdateStakeholderMutationSchema.partial()).
  const sets: string[] = [];
  const args: unknown[] = [];
  const map: Array<[string, string]> = [
    ["name", "name"],
    ["email", "email"],
    ["institutionName", "institution_name"],
    ["stakeholderType", "stakeholder_type"],
    ["currentRelationship", "current_relationship"],
    ["taxId", "tax_id"],
    ["streetAddress", "street_address"],
    ["city", "city"],
    ["state", "state"],
    ["zipcode", "zipcode"],
  ];
  for (const [jsonKey, col] of map) {
    if (o[jsonKey] !== undefined) {
      sets.push(`${col} = ?`);
      args.push(o[jsonKey]);
    }
  }
  if (sets.length === 0) return badReq(["no fields to update"]);
  sets.push("updated_at = ?");
  args.push(now(), ctx.companyId, id);

  const r = db.exec(
    `UPDATE stakeholder SET ${sets.join(", ")} WHERE company_id = ? AND id = ?`,
    args,
  );
  if (r.changes === 0) return notFound("stakeholder not found");
  return okRes({ success: true, message: "Successfully updated the stakeholder" });
}

export function deleteStakeholder(ctx: Ctx): Res {
  const id = ctx.params.id;
  if (!id) return badReq(["stakeholder id is required"]);
  // Refuse to orphan issued securities (the ON DELETE CASCADE in Prisma would
  // silently remove them; a cap table must not lose issued equity by accident).
  const held = db.query(
    `SELECT (SELECT COUNT(*) FROM share  WHERE stakeholder_id = ? AND company_id = ?)
          + (SELECT COUNT(*) FROM option WHERE stakeholder_id = ? AND company_id = ?) AS n`,
    [id, ctx.companyId, id, ctx.companyId],
  );
  if (Number((held[0] as { n: number }).n) > 0) {
    return badReq(["cannot delete a stakeholder that still holds shares or options"]);
  }
  const r = db.exec(`DELETE FROM stakeholder WHERE company_id = ? AND id = ?`, [
    ctx.companyId,
    id,
  ]);
  if (r.changes === 0) return notFound("stakeholder not found");
  return okRes({ success: true });
}
