// Validation — a zod-free port of the tRPC input schemas
// (src/trpc/routers/*/schema.ts). Same required fields, same enum vocabularies,
// same numeric coercion, expressed without the zod runtime (which would bloat
// the goja bundle). Each validator returns { ok, value?, errors? }; a failed
// validation becomes an HTTP 400, mirroring how the app surfaces a ZodError.

// Enum vocabularies — verbatim from prisma/schema.prisma.
export const StakeholderType = ["INDIVIDUAL", "INSTITUTION"] as const;
export const StakeholderRelationship = [
  "ADVISOR",
  "BOARD_MEMBER",
  "CONSULTANT",
  "EMPLOYEE",
  "EX_ADVISOR",
  "EX_CONSULTANT",
  "EX_EMPLOYEE",
  "EXECUTIVE",
  "FOUNDER",
  "INVESTOR",
  "NON_US_EMPLOYEE",
  "OFFICER",
  "OTHER",
] as const;
export const ShareClassType = ["COMMON", "PREFERRED"] as const;
export const ConversionRights = [
  "CONVERTS_TO_FUTURE_ROUND",
  "CONVERTS_TO_SHARE_CLASS_ID",
] as const;
export const SecuritiesStatus = ["ACTIVE", "DRAFT", "SIGNED", "PENDING"] as const;
export const ShareLegends = [
  "US_SECURITIES_ACT",
  "SALE_AND_ROFR",
  "TRANSFER_RESTRICTIONS",
] as const;
export const CancellationBehavior = [
  "RETIRE",
  "RETURN_TO_POOL",
  "HOLD_AS_CAPITAL_STOCK",
  "DEFINED_PER_PLAN_SECURITY",
] as const;
export const OptionType = ["ISO", "NSO", "RSU"] as const;
export const OptionStatus = [
  "DRAFT",
  "ACTIVE",
  "EXERCISED",
  "EXPIRED",
  "CANCELLED",
] as const;
export const SafeType = ["PRE_MONEY", "POST_MONEY"] as const;
export const SafeStatus = [
  "DRAFT",
  "ACTIVE",
  "PENDING",
  "EXPIRED",
  "CANCELLED",
] as const;
export const ConvertibleStatus = [
  "DRAFT",
  "ACTIVE",
  "PENDING",
  "EXPIRED",
  "CANCELLED",
] as const;
export const ConvertibleType = ["CCD", "OCD", "NOTE"] as const;
export const RoundType = ["PRICED", "SAFE", "CONVERTIBLE"] as const;
export const RoundStatus = ["OPEN", "CLOSED"] as const;

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}
export function fail<T>(errors: string[]): Result<T> {
  return { ok: false, errors };
}

type Rec = Record<string, unknown>;

// Field helpers accumulate errors into `errs`.
export function reqString(o: Rec, k: string, errs: string[]): string {
  const v = o[k];
  if (typeof v !== "string" || v.trim() === "") {
    errs.push(`${k} is required`);
    return "";
  }
  return v;
}

export function optString(o: Rec, k: string): string | null {
  const v = o[k];
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

export function email(o: Rec, k: string, errs: string[]): string {
  const v = reqString(o, k, errs);
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    errs.push(`${k} must be a valid email`);
  }
  return v;
}

// coerce number (zod z.coerce.number()): accepts number or numeric string.
export function num(o: Rec, k: string, errs: string[], min?: number): number {
  const raw = o[k];
  const n = typeof raw === "number" ? raw : Number(raw);
  if (raw === undefined || raw === null || Number.isNaN(n)) {
    errs.push(`${k} is required`);
    return 0;
  }
  if (min !== undefined && n < min) {
    errs.push(`${k} must be >= ${min}`);
  }
  return n;
}

export function optNum(o: Rec, k: string): number | null {
  const raw = o[k];
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

export function intNum(o: Rec, k: string, errs: string[], min?: number): number {
  return Math.trunc(num(o, k, errs, min));
}

export function oneOf<T extends string>(
  o: Rec,
  k: string,
  allowed: readonly T[],
  errs: string[],
): T {
  const v = o[k];
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    errs.push(`${k} must be one of ${allowed.join(", ")}`);
    return allowed[0];
  }
  return v as T;
}

// date string (zod z.string().date() / z.coerce.date()): kept verbatim as the
// caller's string; the Go host stores dates as TEXT so no parsing is needed here.
export function dateString(o: Rec, k: string, errs: string[]): string {
  const v = o[k];
  if (typeof v !== "string" || v.trim() === "") {
    errs.push(`${k} is required`);
    return "";
  }
  return v;
}

export function optDateString(o: Rec, k: string): string | null {
  const v = o[k];
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

export function legends(o: Rec, k: string, errs: string[]): string[] {
  const v = o[k];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    errs.push(`${k} must be an array`);
    return [];
  }
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string" || !ShareLegends.includes(item as never)) {
      errs.push(`${k} contains an invalid legend`);
      continue;
    }
    out.push(item);
  }
  return out;
}
