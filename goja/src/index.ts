// @hanzo/captable — goja bundle entry.
//
// SELF-CONTAINED, NO ESM, NO node: imports. Bundled by esbuild into
// goja/bundle.js and run verbatim inside the dop251/goja engine embedded in
// hanzoai/cloud (HIP-0106), hosted by clients/gojabase — the reusable
// read-write-Base binding. See goja/README.md for the full host contract.
//
//   globalThis.__db   = { query(sql,args)->rows, exec(sql,args)->{changes,lastId} }
//   globalThis.__newId = () => string
//   globalThis.__now   = () => number   (unix millis)
//   globalThis.handle({ route, params, orgId, session, body }) -> { status, body }
//
// orgId is the gateway-minted, validated tenant; the host uses it BOTH to select
// the per-tenant SQLite file AND passes it here as the cap-table company id.

import type { Ctx, Res } from "./routes/common";
import { getCompany, updateCompany } from "./routes/company";
import {
  addStakeholders,
  deleteStakeholder,
  listStakeholders,
  updateStakeholder,
} from "./routes/stakeholders";
import {
  createEquityPlan,
  createShareClass,
  listEquityPlans,
  listShareClasses,
  updateShareClass,
} from "./routes/equity";
import {
  addOption,
  addShare,
  deleteOption,
  deleteShare,
  listOptions,
  listShares,
  transferShare,
} from "./routes/securities";
import {
  createConvertible,
  createSafe,
  deleteConvertible,
  deleteSafe,
  listConvertibles,
  listSafes,
} from "./routes/convertibles";
import {
  addInvestment,
  closeRound,
  createRound,
  getRound,
  listInvestments,
  listRounds,
} from "./routes/rounds";
import { capTable } from "./routes/captable";

interface Req {
  route?: string;
  params?: Record<string, string>;
  orgId?: string;
  body?: unknown;
  session?: unknown;
}

type Handler = (ctx: Ctx) => Res;

const routes: Record<string, Handler> = {
  "company.get": getCompany,
  "company.update": updateCompany,

  "stakeholders.list": listStakeholders,
  "stakeholders.add": addStakeholders,
  "stakeholders.update": updateStakeholder,
  "stakeholders.delete": deleteStakeholder,

  "shareClasses.list": listShareClasses,
  "shareClasses.create": createShareClass,
  "shareClasses.update": updateShareClass,

  "equityPlans.list": listEquityPlans,
  "equityPlans.create": createEquityPlan,

  "shares.list": listShares,
  "shares.add": addShare,
  "shares.delete": deleteShare,
  "shares.transfer": transferShare,

  "options.list": listOptions,
  "options.add": addOption,
  "options.delete": deleteOption,

  "safes.list": listSafes,
  "safes.create": createSafe,
  "safes.delete": deleteSafe,

  "convertibles.list": listConvertibles,
  "convertibles.create": createConvertible,
  "convertibles.delete": deleteConvertible,

  "rounds.list": listRounds,
  "rounds.create": createRound,
  "rounds.get": getRound,
  "rounds.close": closeRound,
  "rounds.investments.list": listInvestments,
  "rounds.investments.add": addInvestment,

  captable: capTable,
};

globalThis.handle = (req: Req): Res => {
  req = req || {};
  const route = req.route || "";
  const companyId = req.orgId || "";
  if (!companyId) {
    return { status: 401, body: { success: false, message: "missing tenant" } };
  }
  const fn = routes[route];
  if (!fn) {
    return {
      status: 404,
      body: { success: false, message: `unknown captable route: ${route}` },
    };
  }
  const ctx: Ctx = { companyId, params: req.params || {}, body: req.body };
  try {
    return fn(ctx);
  } catch (err) {
    return {
      status: 500,
      body: {
        success: false,
        message: String((err && (err as Error).message) || err),
      },
    };
  }
};

declare global {
  // eslint-disable-next-line no-var
  var handle: (req: Req) => Res;
}
