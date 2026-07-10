// Host bridge — the ONLY seam between the captable business logic and the world.
//
// The Go host (hanzoai/cloud clients/captable) injects these globals onto the
// goja runtime before calling handle():
//
//   globalThis.__db.query(sql, args)  -> row objects        (SELECT)
//   globalThis.__db.exec(sql, args)   -> { changes, lastId } (INSERT/UPDATE/DELETE)
//   globalThis.__newId()              -> a fresh collision-resistant id
//   globalThis.__now()                -> unix milliseconds (host clock)
//
// There is NO Prisma, NO tRPC, NO next-auth and NO node: builtin in this path.
// Persistence is per-tenant Base/SQLite, owned by the Go host; this bundle only
// issues SQL through the bridge. Every query is already inside ONE tenant's
// database file, and additionally carries the company_id column for defence in
// depth (mirrors the tRPC `where: { companyId }` scope).

export interface Db {
  query(sql: string, args: unknown[]): Record<string, unknown>[];
  exec(sql: string, args: unknown[]): { changes: number; lastId: string };
}

declare global {
  // eslint-disable-next-line no-var
  var __db: Db;
  // eslint-disable-next-line no-var
  var __newId: () => string;
  // eslint-disable-next-line no-var
  var __now: () => number;
}

export const db: Db = {
  query(sql, args) {
    return globalThis.__db.query(sql, args || []);
  },
  exec(sql, args) {
    return globalThis.__db.exec(sql, args || []);
  },
};

export function newId(): string {
  return globalThis.__newId();
}

export function now(): number {
  return globalThis.__now();
}
