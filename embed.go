// Package captable embeds the captable goja bundle so the unified hanzoai/cloud
// binary can host the cap-table business logic in-process via the dop251/goja
// engine (HIP-0106), without copying the bundle into the cloud repo.
//
// The Next.js app + the goja/src TypeScript remain the single source of truth.
// This Go file is a read-only embed:
//
//   - Bundle() returns goja/bundle.js — the self-contained, ESM-free port of the
//     tRPC routers (stakeholders, share classes, securities, cap-table read)
//     that the Go host runs in goja, calling globalThis.handle({route,params,
//     orgId,body}) per request. Persistence is the host's injected globalThis.__db
//     over per-tenant Base/SQLite; there is no Prisma in this path.
//
// Mirrors github.com/hanzoai/plans exactly (the proven precedent).
package captable

import _ "embed"

// Version identifies the embedded bundle for the host's mount log. Bump on any
// change to goja/bundle.js.
const Version = "0.1.0"

//go:embed goja/bundle.js
var bundle []byte

// Bundle returns the goja bundle source (goja/bundle.js). The host compiles it
// once and runs it on each pooled goja runtime.
func Bundle() ([]byte, error) {
	if len(bundle) == 0 {
		return nil, errEmptyBundle
	}
	return bundle, nil
}

// errEmptyBundle is returned if the embed produced no bytes (a build that forgot
// to run goja/build.mjs). Fail loud rather than mount an empty bundle.
var errEmptyBundle = &bundleError{"captable: embedded goja/bundle.js is empty (run `node goja/build.mjs`)"}

type bundleError struct{ msg string }

func (e *bundleError) Error() string { return e.msg }
