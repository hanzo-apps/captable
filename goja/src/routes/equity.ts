// Share classes (src/trpc/routers/share-class) + equity plans
// (src/trpc/routers/equity-plan). Both are prerequisites for issuing securities:
// shares reference a share class; options reference an equity plan.

import { db, newId, now } from "../host";
import {
  asObj,
  badReq,
  type Ctx,
  created,
  notFound,
  okRes,
  refExists,
  type Res,
} from "./common";
import * as v from "../validate";

// ---- Share classes ----

export function listShareClasses(ctx: Ctx): Res {
  const rows = db.query(
    `SELECT sc.id, sc.idx, sc.name, sc.class_type AS classType, sc.prefix,
            sc.initial_shares_authorized AS initialSharesAuthorized,
            sc.votes_per_share AS votesPerShare, sc.par_value AS parValue,
            sc.price_per_share AS pricePerShare, sc.seniority,
            sc.conversion_rights AS conversionRights,
            sc.liquidation_preference_multiple AS liquidationPreferenceMultiple,
            sc.participation_cap_multiple AS participationCapMultiple,
            c.name AS companyName
       FROM share_class sc
       JOIN company c ON c.id = sc.company_id
      WHERE sc.company_id = ?
      ORDER BY sc.idx ASC`,
    [ctx.companyId],
  );
  return okRes(rows);
}

function validateShareClass(o: Record<string, unknown>, errs: string[]) {
  const classType = v.oneOf(o, "classType", v.ShareClassType, errs);
  return {
    name: v.reqString(o, "name", errs),
    classType,
    prefix: classType === "COMMON" ? "CS" : "PS",
    initialSharesAuthorized: v.intNum(o, "initialSharesAuthorized", errs, 1),
    boardApprovalDate: v.dateString(o, "boardApprovalDate", errs),
    stockholderApprovalDate: v.dateString(o, "stockholderApprovalDate", errs),
    votesPerShare: v.intNum(o, "votesPerShare", errs, 0),
    parValue: v.num(o, "parValue", errs, 0),
    pricePerShare: v.num(o, "pricePerShare", errs, 0),
    seniority: v.intNum(o, "seniority", errs, 0),
    conversionRights: v.oneOf(o, "conversionRights", v.ConversionRights, errs),
    convertsToShareClassId: v.optString(o, "convertsToShareClassId"),
    liquidationPreferenceMultiple: v.num(o, "liquidationPreferenceMultiple", errs, 0),
    participationCapMultiple: v.num(o, "participationCapMultiple", errs, 0),
  };
}

export function createShareClass(ctx: Ctx): Res {
  const errs: string[] = [];
  const s = validateShareClass(asObj(ctx.body), errs);
  if (errs.length) return badReq(errs);

  // idx auto-increments per company (tRPC: count(where companyId) + 1).
  const countRows = db.query(
    `SELECT COUNT(*) AS n FROM share_class WHERE company_id = ?`,
    [ctx.companyId],
  );
  const idx = Number((countRows[0] as { n: number }).n) + 1;
  const ts = now();
  db.exec(
    `INSERT INTO share_class
       (id, company_id, idx, name, class_type, prefix,
        initial_shares_authorized, board_approval_date, stockholder_approval_date,
        votes_per_share, par_value, price_per_share, seniority, conversion_rights,
        converts_to_share_class_id, liquidation_preference_multiple,
        participation_cap_multiple, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId(),
      ctx.companyId,
      idx,
      s.name,
      s.classType,
      s.prefix,
      s.initialSharesAuthorized,
      s.boardApprovalDate,
      s.stockholderApprovalDate,
      s.votesPerShare,
      s.parValue,
      s.pricePerShare,
      s.seniority,
      s.conversionRights,
      s.convertsToShareClassId,
      s.liquidationPreferenceMultiple,
      s.participationCapMultiple,
      ts,
      ts,
    ],
  );
  return created({ success: true, message: "Share class created successfully." });
}

export function updateShareClass(ctx: Ctx): Res {
  const id = ctx.params.id;
  if (!id) return badReq(["share class id is required"]);
  const errs: string[] = [];
  const s = validateShareClass(asObj(ctx.body), errs);
  if (errs.length) return badReq(errs);
  const r = db.exec(
    `UPDATE share_class
        SET name = ?, class_type = ?, prefix = ?, initial_shares_authorized = ?,
            board_approval_date = ?, stockholder_approval_date = ?,
            votes_per_share = ?, par_value = ?, price_per_share = ?, seniority = ?,
            conversion_rights = ?, converts_to_share_class_id = ?,
            liquidation_preference_multiple = ?, participation_cap_multiple = ?,
            updated_at = ?
      WHERE company_id = ? AND id = ?`,
    [
      s.name,
      s.classType,
      s.prefix,
      s.initialSharesAuthorized,
      s.boardApprovalDate,
      s.stockholderApprovalDate,
      s.votesPerShare,
      s.parValue,
      s.pricePerShare,
      s.seniority,
      s.conversionRights,
      s.convertsToShareClassId,
      s.liquidationPreferenceMultiple,
      s.participationCapMultiple,
      now(),
      ctx.companyId,
      id,
    ],
  );
  if (r.changes === 0) return notFound("share class not found");
  return okRes({ success: true, message: "Share class updated successfully." });
}

// ---- Equity plans (src/trpc/routers/equity-plan) ----

export function listEquityPlans(ctx: Ctx): Res {
  const rows = db.query(
    `SELECT id, name, board_approval_date AS boardApprovalDate,
            plan_effective_date AS planEffectiveDate,
            initial_shares_reserved AS initialSharesReserved,
            default_cancellation_behavior AS defaultCancellatonBehavior,
            share_class_id AS shareClassId, comments, created_at AS createdAt
       FROM equity_plan WHERE company_id = ?
      ORDER BY created_at DESC`,
    [ctx.companyId],
  );
  return okRes({ data: rows });
}

export function createEquityPlan(ctx: Ctx): Res {
  const o = asObj(ctx.body);
  const errs: string[] = [];
  const name = v.reqString(o, "name", errs);
  const boardApprovalDate = v.dateString(o, "boardApprovalDate", errs);
  const initialSharesReserved = v.intNum(o, "initialSharesReserved", errs, 0);
  const shareClassId = v.reqString(o, "shareClassId", errs);
  const behavior = v.oneOf(o, "defaultCancellatonBehavior", v.CancellationBehavior, errs);
  if (errs.length) return badReq(errs);

  if (!refExists(ctx.companyId, "share_class", shareClassId)) {
    return badReq(["shareClassId does not reference a share class in this company"]);
  }
  const ts = now();
  db.exec(
    `INSERT INTO equity_plan
       (id, company_id, name, board_approval_date, plan_effective_date,
        initial_shares_reserved, default_cancellation_behavior, share_class_id,
        comments, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId(),
      ctx.companyId,
      name,
      boardApprovalDate,
      v.optDateString(o, "planEffectiveDate"),
      initialSharesReserved,
      behavior,
      shareClassId,
      v.optString(o, "comments"),
      ts,
      ts,
    ],
  );
  return created({ success: true, message: "Equity plan created successfully." });
}
