# `goja/` — captable inside the unified cloud binary

`bundle.js` is a **self-contained, ESM-free** port of the captable tRPC business
logic (`src/trpc/routers/{stakeholder,share-class,securities}-router`), authored
in TypeScript (`src/*.ts`) and bundled by esbuild so it runs verbatim inside the
[`dop251/goja`](https://github.com/dop251/goja) JavaScript engine embedded in
[`hanzoai/cloud`](https://github.com/hanzoai/cloud) per HIP-0106. It is the pilot
of the **read-write-Base-via-goja** pattern (epic #96): the same idiom sign (#98)
and dataroom (#99) will replicate.

## Why a bundle?

goja runs ES2020 but **not** ES-module `import`/`export` and **not** `node:`
builtins — so Prisma, tRPC, next-auth and zod cannot load. Rather than rewrite
the logic in Go, the domain + validation logic lives here as TypeScript and runs
in goja; **persistence is delegated to the Go host** through an injected `__db`
bridge (per-tenant Base/SQLite). The bundle carries logic, never a DB engine.

## Host contract

The Go host (`hanzoai/cloud/clients/captable`) injects these globals before the
first dispatch, then calls `handle` per request:

```
globalThis.__db.query(sql, args)  -> row objects          (SELECT)
globalThis.__db.exec(sql, args)   -> { changes, lastId }   (INSERT/UPDATE/DELETE)
globalThis.__newId()              -> collision-resistant id
globalThis.__now()                -> unix milliseconds

globalThis.handle({ route, params, orgId, session, body }) -> { status, body }
```

`orgId` is the gateway-minted, **validated** tenant. The host uses it BOTH to
select the per-tenant SQLite file AND passes it here as the cap-table
`companyId`, so every query is scoped to one tenant — physically (one file per
org) and logically (the `company_id` column), mirroring the tRPC
`where: { companyId }` scope.

### Routes (the full cap-table fold)

| route(s) | HTTP (mounted by the host) |
|---|---|
| `company.get` / `company.update` | GET/PUT `/v1/captable/company` |
| `stakeholders.{list,add,update,delete}` | `/v1/captable/stakeholders[/:id]` |
| `shareClasses.{list,create,update}` | `/v1/captable/share-classes[/:id]` |
| `equityPlans.{list,create}` | `/v1/captable/equity-plans` |
| `shares.{list,add,delete,transfer}` | `/v1/captable/shares[/:id]`, `.../shares/transfer` |
| `options.{list,add,delete}` | `/v1/captable/options[/:id]` |
| `safes.{list,create,delete}` | `/v1/captable/safes[/:id]` |
| `convertibles.{list,create,delete}` | `/v1/captable/convertibles[/:id]` |
| `rounds.{list,create,get,close}` | `/v1/captable/rounds[/:id][/close]` |
| `rounds.investments.{list,add}` | `/v1/captable/rounds/:id/investments`, `/v1/captable/investments` |
| `captable` | GET `/v1/captable/summary` (computed cap table) |

Securities **issuance** (shares + options), **transfers** (full + partial), and
**rounds** (a priced round issues shares to each investor and dilutes the cap
table) are all implemented over Base. The `captable` route computes ownership on
a fully-diluted basis (shares + options), per-class authorized-vs-issued, plus a
convertibles + rounds summary.

Out of this repo's scope by design: documents / data-room (→ dataroom #101),
e-signature (→ esign #100), email. Vesting is stored (cliff/vesting years) but
schedule *computation* is a later enhancement.

## Build & test

```
node goja/build.mjs        # regenerate bundle.js from src/*.ts (esbuild)
node goja/test/bundle.test.mjs   # smoke + wiring test against a mock __db
```

`bundle.js` is **committed** so `hanzoai/cloud` can `go:embed` it via `embed.go`
(`Bundle()`), exactly how `@hanzo/plans` ships `goja/bundle.js`. Edit the
TypeScript, re-run the build, commit the regenerated bundle.
