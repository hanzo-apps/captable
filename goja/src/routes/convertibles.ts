// Convertible instruments — SAFEs (src/trpc/routers/safe) and convertible notes.
// Capital raised on these sits OUTSIDE issued equity until conversion; the cap
// table surfaces it as a separate "convertibles" section.

import { db, newId, now } from "../host";
import {
  asObj,
  badReq,
  conflict,
  type Ctx,
  created,
  notFound,
  okRes,
  refExists,
  type Res,
} from "./common";
import * as v from "../validate";

// ---- SAFEs ----

export function listSafes(ctx: Ctx): Res {
  const rows = db.query(
    `SELECT sf.id, sf.public_id AS publicId, sf.type, sf.status, sf.capital,
            sf.valuation_cap AS valuationCap, sf.discount_rate AS discountRate,
            sf.mfn, sf.pro_rata AS proRata, sf.issue_date AS issueDate,
            st.name AS stakeholderName, st.id AS stakeholderId
       FROM safe sf
       JOIN stakeholder st ON st.id = sf.stakeholder_id
      WHERE sf.company_id = ?
      ORDER BY sf.created_at DESC`,
    [ctx.companyId],
  );
  for (const r of rows) {
    r.mfn = Number(r.mfn) !== 0;
    r.proRata = Number(r.proRata) !== 0;
  }
  return okRes({ data: rows });
}

export function createSafe(ctx: Ctx): Res {
  const o = asObj(ctx.body);
  const errs: string[] = [];
  const publicId = v.reqString(o, "publicId", errs);
  const stakeholderId = v.reqString(o, "stakeholderId", errs);
  const capital = v.num(o, "capital", errs, 0);
  const type = v.oneOf(o, "type", v.SafeType, errs);
  const status = v.oneOf(o, "status", v.SafeStatus, errs);
  const issueDate = v.dateString(o, "issueDate", errs);
  const boardApprovalDate = v.dateString(o, "boardApprovalDate", errs);
  if (errs.length) return badReq(errs);

  if (!refExists(ctx.companyId, "stakeholder", stakeholderId)) {
    return badReq(["stakeholderId does not reference a stakeholder in this company"]);
  }
  if (
    db.query(`SELECT 1 FROM safe WHERE company_id = ? AND public_id = ?`, [
      ctx.companyId,
      publicId,
    ]).length > 0
  ) {
    return conflict("Please use a unique SAFE id.");
  }
  const ts = now();
  db.exec(
    `INSERT INTO safe
       (id, company_id, stakeholder_id, public_id, type, status, capital,
        valuation_cap, discount_rate, mfn, pro_rata, additional_terms,
        issue_date, board_approval_date, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId(),
      ctx.companyId,
      stakeholderId,
      publicId,
      type,
      status,
      capital,
      v.optNum(o, "valuationCap"),
      v.optNum(o, "discountRate"),
      o.mfn ? 1 : 0,
      o.proRata ? 1 : 0,
      v.optString(o, "additionalTerms"),
      issueDate,
      boardApprovalDate,
      ts,
      ts,
    ],
  );
  return created({ success: true, message: "SAFE created successfully." });
}

export function deleteSafe(ctx: Ctx): Res {
  const id = ctx.params.id;
  if (!id) return badReq(["safe id is required"]);
  const r = db.exec(`DELETE FROM safe WHERE company_id = ? AND id = ?`, [
    ctx.companyId,
    id,
  ]);
  if (r.changes === 0) return notFound("safe not found");
  return okRes({ success: true });
}

// ---- Convertible notes ----

export function listConvertibles(ctx: Ctx): Res {
  const rows = db.query(
    `SELECT cn.id, cn.public_id AS publicId, cn.type, cn.status, cn.capital,
            cn.conversion_cap AS conversionCap, cn.discount_rate AS discountRate,
            cn.interest_rate AS interestRate, cn.issue_date AS issueDate,
            st.name AS stakeholderName, st.id AS stakeholderId
       FROM convertible_note cn
       JOIN stakeholder st ON st.id = cn.stakeholder_id
      WHERE cn.company_id = ?
      ORDER BY cn.created_at DESC`,
    [ctx.companyId],
  );
  return okRes({ data: rows });
}

export function createConvertible(ctx: Ctx): Res {
  const o = asObj(ctx.body);
  const errs: string[] = [];
  const publicId = v.reqString(o, "publicId", errs);
  const stakeholderId = v.reqString(o, "stakeholderId", errs);
  const capital = v.num(o, "capital", errs, 0);
  const type = v.oneOf(o, "type", v.ConvertibleType, errs);
  const status = v.oneOf(o, "status", v.ConvertibleStatus, errs);
  const issueDate = v.dateString(o, "issueDate", errs);
  const boardApprovalDate = v.dateString(o, "boardApprovalDate", errs);
  if (errs.length) return badReq(errs);

  if (!refExists(ctx.companyId, "stakeholder", stakeholderId)) {
    return badReq(["stakeholderId does not reference a stakeholder in this company"]);
  }
  if (
    db.query(`SELECT 1 FROM convertible_note WHERE company_id = ? AND public_id = ?`, [
      ctx.companyId,
      publicId,
    ]).length > 0
  ) {
    return conflict("Please use a unique convertible note id.");
  }
  const ts = now();
  db.exec(
    `INSERT INTO convertible_note
       (id, company_id, stakeholder_id, public_id, type, status, capital,
        conversion_cap, discount_rate, mfn, interest_rate, additional_terms,
        issue_date, board_approval_date, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId(),
      ctx.companyId,
      stakeholderId,
      publicId,
      type,
      status,
      capital,
      v.optNum(o, "conversionCap"),
      v.optNum(o, "discountRate"),
      o.mfn ? 1 : 0,
      v.optNum(o, "interestRate"),
      v.optString(o, "additionalTerms"),
      issueDate,
      boardApprovalDate,
      ts,
      ts,
    ],
  );
  return created({ success: true, message: "Convertible note created successfully." });
}

export function deleteConvertible(ctx: Ctx): Res {
  const id = ctx.params.id;
  if (!id) return badReq(["convertible note id is required"]);
  const r = db.exec(`DELETE FROM convertible_note WHERE company_id = ? AND id = ?`, [
    ctx.companyId,
    id,
  ]);
  if (r.changes === 0) return notFound("convertible note not found");
  return okRes({ success: true });
}
