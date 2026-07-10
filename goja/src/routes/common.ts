// Shared request/response types + helpers for the captable route handlers.

import { db } from "../host";

export interface Ctx {
  companyId: string; // == the validated tenant; scopes every row
  params: Record<string, string>;
  body: unknown;
}

export interface Res {
  status: number;
  body: unknown;
}

export const okRes = (body: unknown): Res => ({ status: 200, body });
export const created = (body: unknown): Res => ({ status: 201, body });
export const badReq = (errors: string[]): Res => ({
  status: 400,
  body: { success: false, message: "Validation failed", errors },
});
export const notFound = (msg: string): Res => ({
  status: 404,
  body: { success: false, message: msg },
});
export const conflict = (msg: string): Res => ({
  status: 409,
  body: { success: false, message: msg },
});

export function asObj(body: unknown): Record<string, unknown> {
  return (body || {}) as Record<string, unknown>;
}

// refExists reports whether a row (company_id, id) exists in `table` — the
// in-tenant referential-integrity check the Prisma FKs gave us, enforced at the
// write layer since every entity lives in the same per-tenant DB. `table` is
// always a package constant, never user input (no injection surface).
export function refExists(companyId: string, table: string, id: string): boolean {
  if (!id) return false;
  return (
    db.query(`SELECT 1 FROM ${table} WHERE company_id = ? AND id = ?`, [
      companyId,
      id,
    ]).length > 0
  );
}
