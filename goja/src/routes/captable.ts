// Cap-table computation — the read the whole pilot exists to prove round-trips
// through Base. A real aggregation over issued equity:
//   - outstanding  = Σ share.quantity
//   - fullyDiluted = outstanding + Σ OUTSTANDING option.quantity
//   - per-stakeholder ownership on a fully-diluted basis
//   - per-share-class authorized vs issued
//   - convertibles (SAFE + note capital not yet converted) as a side section
//   - rounds summary (count + total raised)

import { db } from "../host";
import { type Ctx, notFound, okRes, type Res } from "./common";

// Only OUTSTANDING options dilute the cap table. Options in a TERMINAL state are
// excluded from the fully-diluted math and every ownership %:
//   - EXERCISED → already converted to shares (counted in `share`); counting the
//                 option too would DOUBLE-COUNT the same equity.
//   - EXPIRED / CANCELLED → void; the shares will never be issued.
// DRAFT + ACTIVE remain (granted / pending grants that still dilute). Summing ALL
// option rows regardless of status inflated fullyDilutedShares and understated
// every stakeholder's true ownership — a correctness bug on a cap-table surface.
const DILUTIVE_OPTION_STATUS = `status NOT IN ('EXERCISED','EXPIRED','CANCELLED')`;

export function capTable(ctx: Ctx): Res {
  const cid = ctx.companyId;
  const company = db.query(`SELECT id, name FROM company WHERE id = ?`, [cid]);
  if (company.length === 0) return notFound("company not found");

  const num = (rows: Record<string, unknown>[], key: string): number =>
    rows.length ? Number(rows[0][key]) : 0;

  const outstanding = num(
    db.query(`SELECT COALESCE(SUM(quantity),0) AS n FROM share WHERE company_id = ?`, [cid]),
    "n",
  );
  const optionShares = num(
    db.query(
      `SELECT COALESCE(SUM(quantity),0) AS n FROM option WHERE company_id = ? AND ${DILUTIVE_OPTION_STATUS}`,
      [cid],
    ),
    "n",
  );
  const fullyDiluted = outstanding + optionShares;

  // Per-stakeholder shares + options, ownership on the fully-diluted base.
  const byStakeholder = db.query(
    `SELECT st.id AS stakeholderId, st.name,
            COALESCE((SELECT SUM(sh.quantity) FROM share  sh WHERE sh.stakeholder_id = st.id AND sh.company_id = st.company_id), 0) AS shares,
            COALESCE((SELECT SUM(op.quantity) FROM option op WHERE op.stakeholder_id = st.id AND op.company_id = st.company_id AND op.${DILUTIVE_OPTION_STATUS}), 0) AS options
       FROM stakeholder st
      WHERE st.company_id = ?
      ORDER BY shares DESC, options DESC`,
    [cid],
  );
  for (const r of byStakeholder) {
    const shares = Number(r.shares);
    const options = Number(r.options);
    r.shares = shares;
    r.options = options;
    const held = shares + options;
    r.fullyDiluted = held;
    r.ownershipPct =
      fullyDiluted > 0 ? Math.round((held / fullyDiluted) * 10000) / 100 : 0;
  }

  const byShareClass = db.query(
    `SELECT sc.id AS shareClassId, sc.name, sc.class_type AS classType,
            sc.initial_shares_authorized AS authorized,
            COALESCE((SELECT SUM(sh.quantity) FROM share sh WHERE sh.share_class_id = sc.id AND sh.company_id = sc.company_id), 0) AS issued
       FROM share_class sc
      WHERE sc.company_id = ?
      ORDER BY sc.idx ASC`,
    [cid],
  );
  for (const r of byShareClass) {
    r.authorized = Number(r.authorized);
    r.issued = Number(r.issued);
  }

  const convertibles = {
    safes: {
      count: num(db.query(`SELECT COUNT(*) AS n FROM safe WHERE company_id = ?`, [cid]), "n"),
      capital: num(db.query(`SELECT COALESCE(SUM(capital),0) AS n FROM safe WHERE company_id = ?`, [cid]), "n"),
    },
    notes: {
      count: num(db.query(`SELECT COUNT(*) AS n FROM convertible_note WHERE company_id = ?`, [cid]), "n"),
      capital: num(db.query(`SELECT COALESCE(SUM(capital),0) AS n FROM convertible_note WHERE company_id = ?`, [cid]), "n"),
    },
  };

  const rounds = {
    count: num(db.query(`SELECT COUNT(*) AS n FROM round WHERE company_id = ?`, [cid]), "n"),
    totalRaised: num(db.query(`SELECT COALESCE(SUM(raised_amount),0) AS n FROM round WHERE company_id = ?`, [cid]), "n"),
  };

  return okRes({
    company: company[0],
    totals: {
      outstandingShares: outstanding,
      grantedOptions: optionShares,
      fullyDilutedShares: fullyDiluted,
      stakeholders: num(db.query(`SELECT COUNT(*) AS n FROM stakeholder WHERE company_id = ?`, [cid]), "n"),
      shareClasses: num(db.query(`SELECT COUNT(*) AS n FROM share_class WHERE company_id = ?`, [cid]), "n"),
    },
    byStakeholder,
    byShareClass,
    convertibles,
    rounds,
  });
}
