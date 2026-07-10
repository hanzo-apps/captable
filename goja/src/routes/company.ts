// Company — the org's cap-table root. The Go host seeds one row per tenant
// (OnOpen), so companyId always resolves; these routes read/rename it.

import { db, now } from "../host";
import { asObj, badReq, type Ctx, notFound, okRes, type Res } from "./common";
import * as v from "../validate";

export function getCompany(ctx: Ctx): Res {
  const rows = db.query(
    `SELECT id, name, public_id AS publicId, incorporation_type AS incorporationType,
            incorporation_country AS incorporationCountry,
            incorporation_state AS incorporationState,
            created_at AS createdAt, updated_at AS updatedAt
       FROM company WHERE id = ?`,
    [ctx.companyId],
  );
  if (rows.length === 0) return notFound("company not found");
  return okRes(rows[0]);
}

export function updateCompany(ctx: Ctx): Res {
  const o = asObj(ctx.body);
  const errs: string[] = [];
  const name = v.reqString(o, "name", errs);
  if (errs.length) return badReq(errs);
  const r = db.exec(
    `UPDATE company
        SET name = ?, incorporation_type = ?, incorporation_country = ?,
            incorporation_state = ?, updated_at = ?
      WHERE id = ?`,
    [
      name,
      v.optString(o, "incorporationType") || "",
      v.optString(o, "incorporationCountry") || "",
      v.optString(o, "incorporationState") || "",
      now(),
      ctx.companyId,
    ],
  );
  if (r.changes === 0) return notFound("company not found");
  return okRes({ success: true, message: "Company updated" });
}
