// Securities — shares and options (src/trpc/routers/securities-router) plus a
// real share TRANSFER flow. Every write is inside the host's per-request
// transaction, so multi-statement flows (a partial transfer: shrink source +
// insert target) are atomic.

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

// ---- Shares ----

export function listShares(ctx: Ctx): Res {
  const rows = db.query(
    `SELECT sh.id, sh.certificate_id AS certificateId, sh.quantity,
            sh.price_per_share AS pricePerShare,
            sh.capital_contribution AS capitalContribution,
            sh.status, sh.issue_date AS issueDate,
            sh.company_legends AS companyLegends,
            st.name AS stakeholderName, st.id AS stakeholderId,
            sc.class_type AS shareClassType, sc.id AS shareClassId, sc.name AS shareClassName
       FROM share sh
       JOIN stakeholder st ON st.id = sh.stakeholder_id
       JOIN share_class sc ON sc.id = sh.share_class_id
      WHERE sh.company_id = ?
      ORDER BY sh.created_at DESC`,
    [ctx.companyId],
  );
  for (const r of rows) {
    try {
      r.companyLegends = JSON.parse(String(r.companyLegends || "[]"));
    } catch (_e) {
      r.companyLegends = [];
    }
  }
  return okRes({ data: rows });
}

// insertShare is shared with the rounds flow (a priced-round investment issues
// shares). Returns the new share id.
export function insertShare(
  companyId: string,
  s: {
    stakeholderId: string;
    shareClassId: string;
    status: string;
    certificateId: string;
    quantity: number;
    pricePerShare: number | null;
    capitalContribution: number | null;
    ipContribution: number | null;
    debtCancelled: number | null;
    otherContributions: number | null;
    cliffYears: number;
    vestingYears: number;
    companyLegends: string[];
    issueDate: string;
    rule144Date: string | null;
    vestingStartDate: string | null;
    boardApprovalDate: string;
  },
): string {
  const id = newId();
  const ts = now();
  db.exec(
    `INSERT INTO share
       (id, company_id, stakeholder_id, share_class_id, status, certificate_id,
        quantity, price_per_share, capital_contribution, ip_contribution,
        debt_cancelled, other_contributions, cliff_years, vesting_years,
        company_legends, issue_date, rule144_date, vesting_start_date,
        board_approval_date, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      companyId,
      s.stakeholderId,
      s.shareClassId,
      s.status,
      s.certificateId,
      s.quantity,
      s.pricePerShare,
      s.capitalContribution,
      s.ipContribution,
      s.debtCancelled,
      s.otherContributions,
      s.cliffYears,
      s.vestingYears,
      JSON.stringify(s.companyLegends),
      s.issueDate,
      s.rule144Date,
      s.vestingStartDate,
      s.boardApprovalDate,
      ts,
      ts,
    ],
  );
  return id;
}

export function addShare(ctx: Ctx): Res {
  const o = asObj(ctx.body);
  const errs: string[] = [];
  const stakeholderId = v.reqString(o, "stakeholderId", errs);
  const shareClassId = v.reqString(o, "shareClassId", errs);
  const certificateId = v.reqString(o, "certificateId", errs);
  const quantity = v.intNum(o, "quantity", errs, 0);
  const status = v.oneOf(o, "status", v.SecuritiesStatus, errs);
  const rest = {
    pricePerShare: v.optNum(o, "pricePerShare"),
    capitalContribution: v.optNum(o, "capitalContribution"),
    ipContribution: v.optNum(o, "ipContribution"),
    debtCancelled: v.optNum(o, "debtCancelled"),
    otherContributions: v.optNum(o, "otherContributions"),
    cliffYears: v.intNum(o, "cliffYears", errs, 0),
    vestingYears: v.intNum(o, "vestingYears", errs, 0),
    companyLegends: v.legends(o, "companyLegends", errs),
    issueDate: v.dateString(o, "issueDate", errs),
    rule144Date: v.optDateString(o, "rule144Date"),
    vestingStartDate: v.optDateString(o, "vestingStartDate"),
    boardApprovalDate: v.dateString(o, "boardApprovalDate", errs),
  };
  if (errs.length) return badReq(errs);

  if (!refExists(ctx.companyId, "stakeholder", stakeholderId)) {
    return badReq(["stakeholderId does not reference a stakeholder in this company"]);
  }
  if (!refExists(ctx.companyId, "share_class", shareClassId)) {
    return badReq(["shareClassId does not reference a share class in this company"]);
  }
  if (
    db.query(`SELECT 1 FROM share WHERE company_id = ? AND certificate_id = ?`, [
      ctx.companyId,
      certificateId,
    ]).length > 0
  ) {
    return conflict("Please use unique Certificate Id.");
  }

  insertShare(ctx.companyId, {
    stakeholderId,
    shareClassId,
    status,
    certificateId,
    quantity,
    ...rest,
  });
  return created({ success: true, message: "🎉 Successfully added a share" });
}

export function deleteShare(ctx: Ctx): Res {
  const id = ctx.params.id;
  if (!id) return badReq(["share id is required"]);
  const r = db.exec(`DELETE FROM share WHERE company_id = ? AND id = ?`, [
    ctx.companyId,
    id,
  ]);
  if (r.changes === 0) return notFound("share not found");
  return okRes({ success: true });
}

// Transfer part or all of a share certificate to another stakeholder. A FULL
// transfer reassigns the certificate; a PARTIAL transfer shrinks the source and
// issues a new certificate to the recipient (which requires a unique
// certificateId). Both are atomic via the per-request transaction.
export function transferShare(ctx: Ctx): Res {
  const o = asObj(ctx.body);
  const errs: string[] = [];
  const shareId = v.reqString(o, "shareId", errs);
  const toStakeholderId = v.reqString(o, "toStakeholderId", errs);
  if (errs.length) return badReq(errs);

  const rows = db.query(
    `SELECT id, stakeholder_id AS stakeholderId, share_class_id AS shareClassId,
            quantity, status, certificate_id AS certificateId
       FROM share WHERE company_id = ? AND id = ?`,
    [ctx.companyId, shareId],
  );
  if (rows.length === 0) return notFound("share not found");
  const src = rows[0] as {
    quantity: number;
    shareClassId: string;
    status: string;
    certificateId: string;
  };
  const held = Number(src.quantity);

  if (!refExists(ctx.companyId, "stakeholder", toStakeholderId)) {
    return badReq(["toStakeholderId does not reference a stakeholder in this company"]);
  }

  const qtyRaw = o.quantity;
  const qty = qtyRaw === undefined || qtyRaw === null ? held : Math.trunc(Number(qtyRaw));
  if (Number.isNaN(qty) || qty <= 0 || qty > held) {
    return badReq([`quantity must be between 1 and ${held}`]);
  }

  if (qty === held) {
    // Full transfer: reassign the certificate.
    db.exec(
      `UPDATE share SET stakeholder_id = ?, updated_at = ? WHERE company_id = ? AND id = ?`,
      [toStakeholderId, now(), ctx.companyId, shareId],
    );
    return okRes({
      success: true,
      message: "Share transferred",
      transferred: qty,
      newShareId: null,
    });
  }

  // Partial transfer: shrink source, issue a new certificate to the recipient.
  const newCert = v.optString(o, "certificateId");
  if (!newCert) {
    return badReq(["certificateId is required for a partial transfer"]);
  }
  if (
    db.query(`SELECT 1 FROM share WHERE company_id = ? AND certificate_id = ?`, [
      ctx.companyId,
      newCert,
    ]).length > 0
  ) {
    return conflict("Please use unique Certificate Id.");
  }
  db.exec(`UPDATE share SET quantity = ?, updated_at = ? WHERE company_id = ? AND id = ?`, [
    held - qty,
    now(),
    ctx.companyId,
    shareId,
  ]);
  const newId2 = insertShare(ctx.companyId, {
    stakeholderId: toStakeholderId,
    shareClassId: src.shareClassId,
    status: src.status,
    certificateId: newCert,
    quantity: qty,
    pricePerShare: null,
    capitalContribution: null,
    ipContribution: null,
    debtCancelled: null,
    otherContributions: null,
    cliffYears: 0,
    vestingYears: 0,
    companyLegends: [],
    issueDate: new Date(now()).toISOString().slice(0, 10),
    rule144Date: null,
    vestingStartDate: null,
    boardApprovalDate: new Date(now()).toISOString().slice(0, 10),
  });
  return okRes({
    success: true,
    message: "Share partially transferred",
    transferred: qty,
    newShareId: newId2,
  });
}

// ---- Options (src/trpc/routers/securities-router option procedures) ----

export function listOptions(ctx: Ctx): Res {
  const rows = db.query(
    `SELECT o.id, o.grant_id AS grantId, o.quantity,
            o.exercise_price AS exercisePrice, o.type, o.status,
            o.cliff_years AS cliffYears, o.vesting_years AS vestingYears,
            o.issue_date AS issueDate, o.expiration_date AS expirationDate,
            st.name AS stakeholderName, st.id AS stakeholderId,
            ep.name AS equityPlanName, ep.id AS equityPlanId
       FROM option o
       JOIN stakeholder st ON st.id = o.stakeholder_id
       JOIN equity_plan ep ON ep.id = o.equity_plan_id
      WHERE o.company_id = ?
      ORDER BY o.created_at DESC`,
    [ctx.companyId],
  );
  return okRes({ data: rows });
}

export function addOption(ctx: Ctx): Res {
  const o = asObj(ctx.body);
  const errs: string[] = [];
  const grantId = v.reqString(o, "grantId", errs);
  const stakeholderId = v.reqString(o, "stakeholderId", errs);
  const equityPlanId = v.reqString(o, "equityPlanId", errs);
  const quantity = v.intNum(o, "quantity", errs, 0);
  const exercisePrice = v.num(o, "exercisePrice", errs, 0);
  const type = v.oneOf(o, "type", v.OptionType, errs);
  const status = v.oneOf(o, "status", v.OptionStatus, errs);
  const rest = {
    cliffYears: v.intNum(o, "cliffYears", errs, 0),
    vestingYears: v.intNum(o, "vestingYears", errs, 0),
    issueDate: v.dateString(o, "issueDate", errs),
    expirationDate: v.dateString(o, "expirationDate", errs),
    vestingStartDate: v.dateString(o, "vestingStartDate", errs),
    boardApprovalDate: v.dateString(o, "boardApprovalDate", errs),
    rule144Date: v.dateString(o, "rule144Date", errs),
    notes: v.optString(o, "notes"),
  };
  if (errs.length) return badReq(errs);

  if (!refExists(ctx.companyId, "stakeholder", stakeholderId)) {
    return badReq(["stakeholderId does not reference a stakeholder in this company"]);
  }
  if (!refExists(ctx.companyId, "equity_plan", equityPlanId)) {
    return badReq(["equityPlanId does not reference an equity plan in this company"]);
  }
  if (
    db.query(`SELECT 1 FROM option WHERE company_id = ? AND grant_id = ?`, [
      ctx.companyId,
      grantId,
    ]).length > 0
  ) {
    return conflict("Please use unique Grant Id.");
  }
  const ts = now();
  db.exec(
    `INSERT INTO option
       (id, company_id, stakeholder_id, equity_plan_id, grant_id, notes, quantity,
        exercise_price, type, status, cliff_years, vesting_years, issue_date,
        expiration_date, vesting_start_date, board_approval_date, rule144_date,
        created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId(),
      ctx.companyId,
      stakeholderId,
      equityPlanId,
      grantId,
      rest.notes,
      quantity,
      exercisePrice,
      type,
      status,
      rest.cliffYears,
      rest.vestingYears,
      rest.issueDate,
      rest.expirationDate,
      rest.vestingStartDate,
      rest.boardApprovalDate,
      rest.rule144Date,
      ts,
      ts,
    ],
  );
  return created({ success: true, message: "🎉 Successfully added an option" });
}

export function deleteOption(ctx: Ctx): Res {
  const id = ctx.params.id;
  if (!id) return badReq(["option id is required"]);
  const r = db.exec(`DELETE FROM option WHERE company_id = ? AND id = ?`, [
    ctx.companyId,
    id,
  ]);
  if (r.changes === 0) return notFound("option not found");
  return okRes({ success: true });
}
