/**
 * The cap table lives in Hanzo Cloud. Every read and write below is one call to
 * `/v1/captable`, which resolves the tenant from the bearer's own claims — so a
 * company or org id is never sent and never accepted.
 *
 * Transport is plain REST: raw JSON in, real HTTP status out. List shapes are
 * inconsistent across the surface — stakeholders and classes answer a bare
 * array, shares/options/safes/convertibles/rounds/investments wrap in `{ data }`
 * — so one `rows` unwrapper tolerates both, and every normalizer reads camelCase
 * and snake_case and degrades to an honest empty value rather than throwing.
 *
 * Verbs are per route, measured against the live surface rather than assumed:
 * the collections take GET and POST; `company` takes GET and PUT (POST is 404);
 * stakeholders, shares, options, safes and convertibles take DELETE on `/{id}`;
 * stakeholders and classes take PATCH on `/{id}`, plans do not.
 *
 * The cap-table MATH is the backend's — `summary` is read, never recomputed.
 */

const DEFAULT_BASE = "https://api.hanzo.ai";

/** In-cluster this is `http://cloud.hanzo.svc:8000`. */
export const captableApiBase = (): string =>
  (process.env.CAPTABLE_API_URL || "").trim().replace(/\/+$/, "") ||
  DEFAULT_BASE;

/** A refusal from the cap-table backend, carrying the status it refused with. */
export class CaptableApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CaptableApiError";
    this.status = status;
  }
}

// ── Pure helpers (honest defaults, never throw) ──────────────────────────────

const str = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : String(v);

const bool = (v: unknown): boolean => v === true || v === "true" || v === 1;

const num = (v: unknown): number => {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : 0;
};

/** A wire value that is in the vocabulary, or the default when it is not. */
const oneOf = <T extends string>(
  v: unknown,
  vocabulary: Record<string, T>,
  fallback: T,
): T => {
  const s = typeof v === "string" ? v : "";
  return (Object.values(vocabulary) as string[]).includes(s)
    ? (s as T)
    : fallback;
};

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/** A wire date as a `Date`, or null when the field is absent or unparseable. */
export const date = (v: unknown): Date | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Unwrap a list response: a bare array, or a `{ data | items | rows }` envelope. */
export const rows = (payload: unknown): Record<string, unknown>[] => {
  const keep = (xs: unknown[]) =>
    xs.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Record<
      string,
      unknown
    >[];

  if (Array.isArray(payload)) return keep(payload);

  const p = asRecord(payload);
  for (const k of ["data", "items", "rows"]) {
    if (Array.isArray(p[k])) return keep(p[k] as unknown[]);
  }
  return [];
};

// ── Vocabulary ───────────────────────────────────────────────────────────────
//
// The words the cap-table backend accepts. They were Prisma enums while the cap
// table was a set of local tables; they belong to the contract now, so they live
// beside it. The object shape is what `z.nativeEnum` and `Object.values` read.

export const StakeholderTypeEnum = {
  INDIVIDUAL: "INDIVIDUAL",
  INSTITUTION: "INSTITUTION",
} as const;
export type StakeholderTypeEnum =
  (typeof StakeholderTypeEnum)[keyof typeof StakeholderTypeEnum];

export const StakeholderRelationshipEnum = {
  ADVISOR: "ADVISOR",
  BOARD_MEMBER: "BOARD_MEMBER",
  CONSULTANT: "CONSULTANT",
  EMPLOYEE: "EMPLOYEE",
  EX_ADVISOR: "EX_ADVISOR",
  EX_CONSULTANT: "EX_CONSULTANT",
  EX_EMPLOYEE: "EX_EMPLOYEE",
  EXECUTIVE: "EXECUTIVE",
  FOUNDER: "FOUNDER",
  INVESTOR: "INVESTOR",
  NON_US_EMPLOYEE: "NON_US_EMPLOYEE",
  OFFICER: "OFFICER",
  OTHER: "OTHER",
} as const;
export type StakeholderRelationshipEnum =
  (typeof StakeholderRelationshipEnum)[keyof typeof StakeholderRelationshipEnum];

export const SecuritiesStatusEnum = {
  ACTIVE: "ACTIVE",
  DRAFT: "DRAFT",
  SIGNED: "SIGNED",
  PENDING: "PENDING",
} as const;
export type SecuritiesStatusEnum =
  (typeof SecuritiesStatusEnum)[keyof typeof SecuritiesStatusEnum];

export const ShareLegendsEnum = {
  US_SECURITIES_ACT: "US_SECURITIES_ACT",
  SALE_AND_ROFR: "SALE_AND_ROFR",
  TRANSFER_RESTRICTIONS: "TRANSFER_RESTRICTIONS",
} as const;
export type ShareLegendsEnum =
  (typeof ShareLegendsEnum)[keyof typeof ShareLegendsEnum];

export const OptionTypeEnum = { ISO: "ISO", NSO: "NSO", RSU: "RSU" } as const;
export type OptionTypeEnum =
  (typeof OptionTypeEnum)[keyof typeof OptionTypeEnum];

export const OptionStatusEnum = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  EXERCISED: "EXERCISED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
} as const;
export type OptionStatusEnum =
  (typeof OptionStatusEnum)[keyof typeof OptionStatusEnum];

/** The YC standard SAFEs this app ships a PDF for, plus a customer's own. */
export const SafeTemplateEnum = {
  POST_MONEY_CAP: "POST_MONEY_CAP",
  POST_MONEY_DISCOUNT: "POST_MONEY_DISCOUNT",
  POST_MONEY_MFN: "POST_MONEY_MFN",
  POST_MONEY_CAP_WITH_PRO_RATA: "POST_MONEY_CAP_WITH_PRO_RATA",
  POST_MONEY_DISCOUNT_WITH_PRO_RATA: "POST_MONEY_DISCOUNT_WITH_PRO_RATA",
  POST_MONEY_MFN_WITH_PRO_RATA: "POST_MONEY_MFN_WITH_PRO_RATA",
  CUSTOM: "CUSTOM",
} as const;
export type SafeTemplateEnum =
  (typeof SafeTemplateEnum)[keyof typeof SafeTemplateEnum];

// ── Contract (mirrors the console client at hanzoai/console) ─────────────────

export interface Company {
  id: string;
  name: string;
  publicId: string;
  incorporationType: string;
  incorporationCountry: string;
  incorporationState: string;
}

export interface Stakeholder {
  id: string;
  name: string;
  email: string;
  institutionName: string;
  stakeholderType: StakeholderTypeEnum;
  currentRelationship: StakeholderRelationshipEnum;
  taxId: string;
  streetAddress: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  companyName: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ShareClass {
  id: string;
  idx: number;
  name: string;
  classType: string;
  prefix: string;
  initialSharesAuthorized: number;
  boardApprovalDate: Date | null;
  stockholderApprovalDate: Date | null;
  votesPerShare: number;
  parValue: number;
  pricePerShare: number;
  seniority: number;
  conversionRights: string;
  convertsToShareClassId: string | null;
  liquidationPreferenceMultiple: number;
  participationCapMultiple: number;
  companyName: string;
}

export interface EquityPlan {
  id: string;
  name: string;
  initialSharesReserved: number;
  shareClassId: string;
  boardApprovalDate: Date | null;
  planEffectiveDate: Date | null;
  defaultCancellatonBehavior: string;
  comments: string | null;
  createdAt: Date | null;
}

export interface Share {
  id: string;
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
  status: string;
  issueDate: Date | null;
  rule144Date: Date | null;
  vestingStartDate: Date | null;
  boardApprovalDate: Date | null;
  stakeholderId: string;
  stakeholderName: string;
  shareClassId: string;
  shareClassName: string;
  shareClassType: string;
}

export interface OptionGrant {
  id: string;
  grantId: string;
  quantity: number;
  exercisePrice: number;
  type: string;
  status: string;
  cliffYears: number;
  vestingYears: number;
  issueDate: Date | null;
  expirationDate: Date | null;
  vestingStartDate: Date | null;
  boardApprovalDate: Date | null;
  rule144Date: Date | null;
  stakeholderId: string;
  stakeholderName: string;
  equityPlanId: string;
  equityPlanName: string;
}

export interface Safe {
  id: string;
  publicId: string;
  type: string;
  status: string;
  capital: number;
  safeTemplate: string | null;
  valuationCap: number | null;
  discountRate: number | null;
  mfn: boolean;
  proRata: boolean;
  additionalTerms: string | null;
  issueDate: Date | null;
  boardApprovalDate: Date | null;
  stakeholderId: string;
  stakeholderName: string;
}

export interface Convertible {
  id: string;
  publicId: string;
  type: string;
  status: string;
  capital: number;
  conversionCap: number | null;
  discountRate: number | null;
  interestRate: number | null;
  additionalTerms: string | null;
  issueDate: Date | null;
  boardApprovalDate: Date | null;
  stakeholderId: string;
  stakeholderName: string;
}

export interface Round {
  id: string;
  name: string;
  roundType: string;
  status: string;
  targetAmount: number;
  raisedAmount: number;
  preMoneyValuation: number;
  pricePerShare: number;
  shareClassId: string;
  closeDate: Date | null;
  createdAt: Date | null;
}

export interface Investment {
  id: string;
  roundId: string;
  amount: number;
  shares: number;
  date: Date | null;
  comments: string | null;
  stakeholderId: string;
  stakeholderName: string;
}

/** The computed cap table (`GET /v1/captable/summary`). */
export interface CapTableSummary {
  company: { id: string; name: string };
  totals: {
    outstandingShares: number;
    grantedOptions: number;
    fullyDilutedShares: number;
    stakeholders: number;
    shareClasses: number;
  };
  byStakeholder: {
    stakeholderId: string;
    name: string;
    shares: number;
    options: number;
    fullyDiluted: number;
    ownershipPct: number;
  }[];
  byShareClass: {
    shareClassId: string;
    name: string;
    classType: string;
    authorized: number;
    issued: number;
  }[];
  convertibles: {
    safes: { count: number; capital: number };
    notes: { count: number; capital: number };
  };
  rounds: { count: number; totalRaised: number };
}

// ── Normalizers (pure; defensive) ────────────────────────────────────────────
//
// Every field is read from both spellings the surface uses. A field the backend
// does not carry lands on the empty value its column allows — null where the
// value is optional, 0 or [] where it is not — so a missing measurement is never
// dressed up as a measured one.

const nullable = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : num(v);

const text = (v: unknown): string | null => {
  const s = str(v);
  return s === "" ? null : s;
};

export const normalizeCompany = (payload: unknown): Company => {
  const r = asRecord(payload);
  return {
    id: str(r.id),
    name: str(r.name),
    publicId: str(r.publicId ?? r.public_id),
    incorporationType: str(r.incorporationType ?? r.incorporation_type),
    incorporationCountry: str(
      r.incorporationCountry ?? r.incorporation_country,
    ),
    incorporationState: str(r.incorporationState ?? r.incorporation_state),
  };
};

export const normalizeStakeholder = (
  r: Record<string, unknown>,
): Stakeholder => ({
  id: str(r.id),
  name: str(r.name),
  email: str(r.email),
  institutionName: str(r.institutionName ?? r.institution_name),
  stakeholderType: oneOf(
    r.stakeholderType ?? r.stakeholder_type,
    StakeholderTypeEnum,
    "INDIVIDUAL",
  ),
  currentRelationship: oneOf(
    r.currentRelationship ?? r.current_relationship,
    StakeholderRelationshipEnum,
    "EMPLOYEE",
  ),
  taxId: str(r.taxId ?? r.tax_id),
  streetAddress: str(r.streetAddress ?? r.street_address),
  city: str(r.city),
  state: str(r.state),
  zipcode: str(r.zipcode),
  country: str(r.country) || "US",
  companyName: str(r.companyName ?? r.company_name),
  createdAt: date(r.createdAt ?? r.created_at),
  updatedAt: date(r.updatedAt ?? r.updated_at),
});

export const normalizeShareClass = (
  r: Record<string, unknown>,
): ShareClass => ({
  id: str(r.id),
  idx: num(r.idx),
  name: str(r.name),
  classType: str(r.classType ?? r.class_type) || "COMMON",
  prefix: str(r.prefix) || "CS",
  initialSharesAuthorized: num(
    r.initialSharesAuthorized ?? r.initial_shares_authorized,
  ),
  boardApprovalDate: date(r.boardApprovalDate ?? r.board_approval_date),
  stockholderApprovalDate: date(
    r.stockholderApprovalDate ?? r.stockholder_approval_date,
  ),
  votesPerShare: num(r.votesPerShare ?? r.votes_per_share),
  parValue: num(r.parValue ?? r.par_value),
  pricePerShare: num(r.pricePerShare ?? r.price_per_share),
  seniority: num(r.seniority),
  conversionRights:
    str(r.conversionRights ?? r.conversion_rights) ||
    "CONVERTS_TO_FUTURE_ROUND",
  convertsToShareClassId: text(
    r.convertsToShareClassId ?? r.converts_to_share_class_id,
  ),
  liquidationPreferenceMultiple: num(
    r.liquidationPreferenceMultiple ?? r.liquidation_preference_multiple,
  ),
  participationCapMultiple: num(
    r.participationCapMultiple ?? r.participation_cap_multiple,
  ),
  companyName: str(r.companyName ?? r.company_name),
});

export const normalizeEquityPlan = (
  r: Record<string, unknown>,
): EquityPlan => ({
  id: str(r.id),
  name: str(r.name),
  initialSharesReserved: num(
    r.initialSharesReserved ?? r.initial_shares_reserved,
  ),
  shareClassId: str(r.shareClassId ?? r.share_class_id),
  boardApprovalDate: date(r.boardApprovalDate ?? r.board_approval_date),
  planEffectiveDate: date(r.planEffectiveDate ?? r.plan_effective_date),
  defaultCancellatonBehavior:
    str(r.defaultCancellatonBehavior ?? r.default_cancellaton_behavior) ||
    "RETURN_TO_POOL",
  comments: text(r.comments),
  createdAt: date(r.createdAt ?? r.created_at),
});

export const normalizeShare = (r: Record<string, unknown>): Share => ({
  id: str(r.id),
  certificateId: str(r.certificateId ?? r.certificate_id),
  quantity: num(r.quantity),
  pricePerShare: nullable(r.pricePerShare ?? r.price_per_share),
  capitalContribution: nullable(
    r.capitalContribution ?? r.capital_contribution,
  ),
  ipContribution: nullable(r.ipContribution ?? r.ip_contribution),
  debtCancelled: nullable(r.debtCancelled ?? r.debt_cancelled),
  otherContributions: nullable(r.otherContributions ?? r.other_contributions),
  cliffYears: num(r.cliffYears ?? r.cliff_years),
  vestingYears: num(r.vestingYears ?? r.vesting_years),
  companyLegends: Array.isArray(r.companyLegends ?? r.company_legends)
    ? ((r.companyLegends ?? r.company_legends) as unknown[]).map(str)
    : [],
  status: str(r.status) || "DRAFT",
  issueDate: date(r.issueDate ?? r.issue_date),
  rule144Date: date(r.rule144Date ?? r.rule144_date),
  vestingStartDate: date(r.vestingStartDate ?? r.vesting_start_date),
  boardApprovalDate: date(r.boardApprovalDate ?? r.board_approval_date),
  stakeholderId: str(r.stakeholderId ?? r.stakeholder_id),
  stakeholderName: str(r.stakeholderName ?? r.stakeholder_name),
  shareClassId: str(r.shareClassId ?? r.share_class_id),
  shareClassName: str(r.shareClassName ?? r.share_class_name),
  shareClassType: str(r.shareClassType ?? r.share_class_type),
});

export const normalizeOption = (r: Record<string, unknown>): OptionGrant => ({
  id: str(r.id),
  grantId: str(r.grantId ?? r.grant_id),
  quantity: num(r.quantity),
  exercisePrice: num(r.exercisePrice ?? r.exercise_price),
  type: str(r.type) || "ISO",
  status: str(r.status) || "DRAFT",
  cliffYears: num(r.cliffYears ?? r.cliff_years),
  vestingYears: num(r.vestingYears ?? r.vesting_years),
  issueDate: date(r.issueDate ?? r.issue_date),
  expirationDate: date(r.expirationDate ?? r.expiration_date),
  vestingStartDate: date(r.vestingStartDate ?? r.vesting_start_date),
  boardApprovalDate: date(r.boardApprovalDate ?? r.board_approval_date),
  rule144Date: date(r.rule144Date ?? r.rule144_date),
  stakeholderId: str(r.stakeholderId ?? r.stakeholder_id),
  stakeholderName: str(r.stakeholderName ?? r.stakeholder_name),
  equityPlanId: str(r.equityPlanId ?? r.equity_plan_id),
  equityPlanName: str(r.equityPlanName ?? r.equity_plan_name),
});

export const normalizeSafe = (r: Record<string, unknown>): Safe => ({
  id: str(r.id),
  publicId: str(r.publicId ?? r.public_id),
  type: str(r.type) || "POST_MONEY",
  status: str(r.status) || "DRAFT",
  capital: num(r.capital),
  safeTemplate: text(r.safeTemplate ?? r.safe_template),
  valuationCap: nullable(r.valuationCap ?? r.valuation_cap),
  discountRate: nullable(r.discountRate ?? r.discount_rate),
  mfn: bool(r.mfn),
  proRata: bool(r.proRata ?? r.pro_rata),
  additionalTerms: text(r.additionalTerms ?? r.additional_terms),
  issueDate: date(r.issueDate ?? r.issue_date),
  boardApprovalDate: date(r.boardApprovalDate ?? r.board_approval_date),
  stakeholderId: str(r.stakeholderId ?? r.stakeholder_id),
  stakeholderName: str(r.stakeholderName ?? r.stakeholder_name),
});

export const normalizeConvertible = (
  r: Record<string, unknown>,
): Convertible => ({
  id: str(r.id),
  publicId: str(r.publicId ?? r.public_id),
  type: str(r.type) || "NOTE",
  status: str(r.status) || "DRAFT",
  capital: num(r.capital),
  conversionCap: nullable(r.conversionCap ?? r.conversion_cap),
  discountRate: nullable(r.discountRate ?? r.discount_rate),
  interestRate: nullable(r.interestRate ?? r.interest_rate),
  additionalTerms: text(r.additionalTerms ?? r.additional_terms),
  issueDate: date(r.issueDate ?? r.issue_date),
  boardApprovalDate: date(r.boardApprovalDate ?? r.board_approval_date),
  stakeholderId: str(r.stakeholderId ?? r.stakeholder_id),
  stakeholderName: str(r.stakeholderName ?? r.stakeholder_name),
});

export const normalizeRound = (r: Record<string, unknown>): Round => ({
  id: str(r.id),
  name: str(r.name),
  roundType: str(r.roundType ?? r.round_type) || "PRICED",
  status: str(r.status) || "OPEN",
  targetAmount: num(r.targetAmount ?? r.target_amount),
  raisedAmount: num(r.raisedAmount ?? r.raised_amount),
  preMoneyValuation: num(r.preMoneyValuation ?? r.pre_money_valuation),
  pricePerShare: num(r.pricePerShare ?? r.price_per_share),
  shareClassId: str(r.shareClassId ?? r.share_class_id),
  closeDate: date(r.closeDate ?? r.close_date),
  createdAt: date(r.createdAt ?? r.created_at),
});

export const normalizeInvestment = (
  r: Record<string, unknown>,
): Investment => ({
  id: str(r.id),
  roundId: str(r.roundId ?? r.round_id),
  amount: num(r.amount),
  shares: num(r.shares),
  date: date(r.date),
  comments: text(r.comments),
  stakeholderId: str(r.stakeholderId ?? r.stakeholder_id),
  stakeholderName: str(r.stakeholderName ?? r.stakeholder_name),
});

export function normalizeSummary(payload: unknown): CapTableSummary {
  const p = asRecord(payload);
  const totals = asRecord(p.totals);
  const conv = asRecord(p.convertibles);
  const safes = asRecord(conv.safes);
  const notes = asRecord(conv.notes);
  const rnd = asRecord(p.rounds);
  const company = asRecord(p.company);

  return {
    company: { id: str(company.id), name: str(company.name) },
    totals: {
      outstandingShares: num(totals.outstandingShares),
      grantedOptions: num(totals.grantedOptions),
      fullyDilutedShares: num(totals.fullyDilutedShares),
      stakeholders: num(totals.stakeholders),
      shareClasses: num(totals.shareClasses),
    },
    byStakeholder: (Array.isArray(p.byStakeholder) ? p.byStakeholder : []).map(
      (raw) => {
        const r = asRecord(raw);
        return {
          stakeholderId: str(r.stakeholderId),
          name: str(r.name),
          shares: num(r.shares),
          options: num(r.options),
          fullyDiluted: num(r.fullyDiluted),
          ownershipPct: num(r.ownershipPct),
        };
      },
    ),
    byShareClass: (Array.isArray(p.byShareClass) ? p.byShareClass : []).map(
      (raw) => {
        const r = asRecord(raw);
        return {
          shareClassId: str(r.shareClassId),
          name: str(r.name),
          classType: str(r.classType),
          authorized: num(r.authorized),
          issued: num(r.issued),
        };
      },
    ),
    convertibles: {
      safes: { count: num(safes.count), capital: num(safes.capital) },
      notes: { count: num(notes.count), capital: num(notes.capital) },
    },
    rounds: { count: num(rnd.count), totalRaised: num(rnd.totalRaised) },
  };
}

// ── Transport ────────────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** The reason the backend gave, or the status line when it gave none. */
const reasonOf = (status: number, body: string): string => {
  try {
    const p = asRecord(JSON.parse(body));
    const reason = str(p.error || p.message || p.msg);
    if (reason) return reason;
  } catch {
    // A non-JSON body is the reason itself.
  }
  return body.trim().slice(0, 200) || `cap-table backend returned ${status}`;
};

async function call(
  bearer: string,
  method: Method,
  path: string,
  body?: unknown,
): Promise<unknown> {
  if (!bearer) {
    throw new CaptableApiError(
      401,
      "No Hanzo access token on this session. Sign in again.",
    );
  }

  const res = await fetch(`${captableApiBase()}/v1/captable/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${bearer}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });

  const raw = await res.text();
  if (!res.ok)
    throw new CaptableApiError(res.status, reasonOf(res.status, raw));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new CaptableApiError(
      502,
      `cap-table backend answered ${res.status} with a body that is not JSON`,
    );
  }
}

const seg = (id: string): string => encodeURIComponent(id);

/**
 * What to tell the person whose cap-table write did not land. A refusal carries
 * the backend's own reason, because "something went wrong" sends them nowhere.
 */
export const captableFailure = (error: unknown): string => {
  if (!(error instanceof CaptableApiError)) {
    return "Oops, something went wrong. Please try again later.";
  }
  return error.status === 401 || error.status === 403
    ? "Your Hanzo session cannot reach the cap table. Sign in again."
    : error.message;
};

/**
 * The cap-table surface as the signed-in user. The bearer decides the tenant,
 * so two callers holding two tokens can never read each other's cap table.
 */
export function captableApi(bearer: string) {
  const get = (path: string) => call(bearer, "GET", path);
  const post = (path: string, body: unknown) =>
    call(bearer, "POST", path, body);

  return {
    summary: (): Promise<CapTableSummary> =>
      get("summary").then(normalizeSummary),

    company: {
      get: (): Promise<Company> => get("company").then(normalizeCompany),
      update: (body: Record<string, unknown>): Promise<void> =>
        call(bearer, "PUT", "company", body).then(() => undefined),
    },

    stakeholders: {
      list: (): Promise<Stakeholder[]> =>
        get("stakeholders").then((p) => rows(p).map(normalizeStakeholder)),
      add: (body: unknown): Promise<void> =>
        post("stakeholders", body).then(() => undefined),
      update: (id: string, body: Record<string, unknown>): Promise<void> =>
        call(bearer, "PATCH", `stakeholders/${seg(id)}`, body).then(
          () => undefined,
        ),
      remove: (id: string): Promise<void> =>
        call(bearer, "DELETE", `stakeholders/${seg(id)}`).then(() => undefined),
    },

    classes: {
      list: (): Promise<ShareClass[]> =>
        get("classes").then((p) => rows(p).map(normalizeShareClass)),
      add: (body: Record<string, unknown>): Promise<void> =>
        post("classes", body).then(() => undefined),
      update: (id: string, body: Record<string, unknown>): Promise<void> =>
        call(bearer, "PATCH", `classes/${seg(id)}`, body).then(() => undefined),
    },

    plans: {
      list: (): Promise<EquityPlan[]> =>
        get("plans").then((p) => rows(p).map(normalizeEquityPlan)),
      add: (body: Record<string, unknown>): Promise<void> =>
        post("plans", body).then(() => undefined),
    },

    shares: {
      list: (): Promise<Share[]> =>
        get("shares").then((p) => rows(p).map(normalizeShare)),
      add: (body: Record<string, unknown>): Promise<void> =>
        post("shares", body).then(() => undefined),
      transfer: (body: Record<string, unknown>): Promise<void> =>
        post("shares/transfer", body).then(() => undefined),
      remove: (id: string): Promise<void> =>
        call(bearer, "DELETE", `shares/${seg(id)}`).then(() => undefined),
    },

    options: {
      list: (): Promise<OptionGrant[]> =>
        get("options").then((p) => rows(p).map(normalizeOption)),
      add: (body: Record<string, unknown>): Promise<void> =>
        post("options", body).then(() => undefined),
      remove: (id: string): Promise<void> =>
        call(bearer, "DELETE", `options/${seg(id)}`).then(() => undefined),
    },

    safes: {
      list: (): Promise<Safe[]> =>
        get("safes").then((p) => rows(p).map(normalizeSafe)),
      add: (body: Record<string, unknown>): Promise<void> =>
        post("safes", body).then(() => undefined),
      remove: (id: string): Promise<void> =>
        call(bearer, "DELETE", `safes/${seg(id)}`).then(() => undefined),
    },

    convertibles: {
      list: (): Promise<Convertible[]> =>
        get("convertibles").then((p) => rows(p).map(normalizeConvertible)),
      add: (body: Record<string, unknown>): Promise<void> =>
        post("convertibles", body).then(() => undefined),
      remove: (id: string): Promise<void> =>
        call(bearer, "DELETE", `convertibles/${seg(id)}`).then(() => undefined),
    },

    rounds: {
      list: (): Promise<Round[]> =>
        get("rounds").then((p) => rows(p).map(normalizeRound)),
      add: (body: Record<string, unknown>): Promise<void> =>
        post("rounds", body).then(() => undefined),
      close: (id: string): Promise<void> =>
        post(`rounds/${seg(id)}/close`, {}).then(() => undefined),
      addInvestment: (
        id: string,
        body: Record<string, unknown>,
      ): Promise<void> =>
        post(`rounds/${seg(id)}/investments`, body).then(() => undefined),
    },

    investments: {
      list: (): Promise<Investment[]> =>
        get("investments").then((p) => rows(p).map(normalizeInvestment)),
    },
  };
}

export type CaptableApi = ReturnType<typeof captableApi>;
