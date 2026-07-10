// Financing rounds + investments. A round groups a fundraising event; a PRICED
// round issues shares to each investor at its price-per-share (so the cap table
// dilutes), while SAFE/CONVERTIBLE rounds only record capital (the instruments
// live in convertibles.ts and convert later). Adding an investment updates the
// round's raised total. Every write is inside the host's per-request transaction,
// so "record investment + issue shares + bump raised" is atomic.

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
import { insertShare } from "./securities";

export function listRounds(ctx: Ctx): Res {
  const rows = db.query(
    `SELECT id, name, round_type AS roundType, status,
            target_amount AS targetAmount, raised_amount AS raisedAmount,
            pre_money_valuation AS preMoneyValuation,
            price_per_share AS pricePerShare, share_class_id AS shareClassId,
            close_date AS closeDate, created_at AS createdAt
       FROM round WHERE company_id = ?
      ORDER BY created_at DESC`,
    [ctx.companyId],
  );
  return okRes({ data: rows });
}

export function createRound(ctx: Ctx): Res {
  const o = asObj(ctx.body);
  const errs: string[] = [];
  const name = v.reqString(o, "name", errs);
  const roundType = v.oneOf(o, "roundType", v.RoundType, errs);
  const targetAmount = v.num(o, "targetAmount", errs, 0);
  if (errs.length) return badReq(errs);

  let shareClassId: string | null = null;
  let pricePerShare: number | null = null;
  let preMoney: number | null = null;
  if (roundType === "PRICED") {
    const perrs: string[] = [];
    shareClassId = v.reqString(o, "shareClassId", perrs);
    pricePerShare = v.num(o, "pricePerShare", perrs, 0);
    preMoney = v.optNum(o, "preMoneyValuation");
    if (pricePerShare <= 0) perrs.push("pricePerShare must be > 0 for a priced round");
    if (perrs.length) return badReq(perrs);
    if (!refExists(ctx.companyId, "share_class", shareClassId)) {
      return badReq(["shareClassId does not reference a share class in this company"]);
    }
  }

  const ts = now();
  const id = newId();
  db.exec(
    `INSERT INTO round
       (id, company_id, name, round_type, status, target_amount, raised_amount,
        pre_money_valuation, price_per_share, share_class_id, close_date,
        created_at, updated_at)
     VALUES (?,?,?,?, 'OPEN', ?, 0, ?, ?, ?, NULL, ?, ?)`,
    [id, ctx.companyId, name, roundType, targetAmount, preMoney, pricePerShare, shareClassId, ts, ts],
  );
  return created({ success: true, message: "Round created.", id });
}

export function getRound(ctx: Ctx): Res {
  const id = ctx.params.id;
  if (!id) return badReq(["round id is required"]);
  const rows = db.query(
    `SELECT id, name, round_type AS roundType, status,
            target_amount AS targetAmount, raised_amount AS raisedAmount,
            pre_money_valuation AS preMoneyValuation,
            price_per_share AS pricePerShare, share_class_id AS shareClassId,
            close_date AS closeDate, created_at AS createdAt
       FROM round WHERE company_id = ? AND id = ?`,
    [ctx.companyId, id],
  );
  if (rows.length === 0) return notFound("round not found");
  const investments = db.query(
    `SELECT i.id, i.amount, i.shares, i.date, i.comments,
            st.name AS stakeholderName, st.id AS stakeholderId
       FROM investment i
       JOIN stakeholder st ON st.id = i.stakeholder_id
      WHERE i.company_id = ? AND i.round_id = ?
      ORDER BY i.created_at ASC`,
    [ctx.companyId, id],
  );
  for (const r of investments) r.shares = Number(r.shares);
  return okRes({ round: rows[0], investments });
}

export function closeRound(ctx: Ctx): Res {
  const id = ctx.params.id;
  if (!id) return badReq(["round id is required"]);
  const o = asObj(ctx.body);
  const closeDate = v.optDateString(o, "closeDate") || new Date(now()).toISOString().slice(0, 10);
  const r = db.exec(
    `UPDATE round SET status = 'CLOSED', close_date = ?, updated_at = ?
      WHERE company_id = ? AND id = ? AND status = 'OPEN'`,
    [closeDate, now(), ctx.companyId, id],
  );
  if (r.changes === 0) return notFound("open round not found");
  return okRes({ success: true, message: "Round closed." });
}

export function listInvestments(ctx: Ctx): Res {
  const rows = db.query(
    `SELECT i.id, i.round_id AS roundId, i.amount, i.shares, i.date,
            i.share_class_id AS shareClassId, st.name AS stakeholderName,
            st.id AS stakeholderId
       FROM investment i
       JOIN stakeholder st ON st.id = i.stakeholder_id
      WHERE i.company_id = ?
      ORDER BY i.created_at DESC`,
    [ctx.companyId],
  );
  for (const r of rows) r.shares = Number(r.shares);
  return okRes({ data: rows });
}

// POST /rounds/:id/investments — record an investor's cheque into a round. For a
// PRICED round this ALSO issues shares (quantity = floor(amount / pricePerShare))
// in the round's share class, so the investment shows up as real equity in the
// cap table. Atomic (per-request transaction).
export function addInvestment(ctx: Ctx): Res {
  const roundId = ctx.params.id;
  if (!roundId) return badReq(["round id is required"]);
  const o = asObj(ctx.body);
  const errs: string[] = [];
  const stakeholderId = v.reqString(o, "stakeholderId", errs);
  const amount = v.num(o, "amount", errs, 0);
  if (errs.length) return badReq(errs);

  const roundRows = db.query(
    `SELECT id, round_type AS roundType, status, price_per_share AS pricePerShare,
            share_class_id AS shareClassId
       FROM round WHERE company_id = ? AND id = ?`,
    [ctx.companyId, roundId],
  );
  if (roundRows.length === 0) return notFound("round not found");
  const round = roundRows[0] as {
    roundType: string;
    status: string;
    pricePerShare: number | null;
    shareClassId: string | null;
  };
  if (round.status !== "OPEN") return badReq(["round is not open for investment"]);
  if (!refExists(ctx.companyId, "stakeholder", stakeholderId)) {
    return badReq(["stakeholderId does not reference a stakeholder in this company"]);
  }

  const date = v.optDateString(o, "date") || new Date(now()).toISOString().slice(0, 10);
  let shares = 0;
  let newShareId: string | null = null;

  if (round.roundType === "PRICED") {
    const pps = Number(round.pricePerShare);
    shares = Math.floor(amount / pps);
    if (shares <= 0) return badReq(["amount is too small to buy a whole share at this round price"]);
    const cert = `INV-${roundId.slice(1, 9)}-${newId().slice(1, 7)}`;
    newShareId = insertShare(ctx.companyId, {
      stakeholderId,
      shareClassId: String(round.shareClassId),
      status: "ACTIVE",
      certificateId: cert,
      quantity: shares,
      pricePerShare: pps,
      capitalContribution: amount,
      ipContribution: null,
      debtCancelled: null,
      otherContributions: null,
      cliffYears: 0,
      vestingYears: 0,
      companyLegends: [],
      issueDate: date,
      rule144Date: null,
      vestingStartDate: null,
      boardApprovalDate: date,
    });
  }

  const ts = now();
  const invId = newId();
  db.exec(
    `INSERT INTO investment
       (id, company_id, round_id, stakeholder_id, share_class_id, amount, shares,
        date, comments, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      invId,
      ctx.companyId,
      roundId,
      stakeholderId,
      round.shareClassId,
      amount,
      shares,
      date,
      v.optString(o, "comments"),
      ts,
      ts,
    ],
  );
  db.exec(
    `UPDATE round SET raised_amount = raised_amount + ?, updated_at = ? WHERE company_id = ? AND id = ?`,
    [amount, ts, ctx.companyId, roundId],
  );
  return created({
    success: true,
    message: "Investment recorded.",
    id: invId,
    sharesIssued: shares,
    newShareId,
  });
}
