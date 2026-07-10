// hanzoai/captable — Go embed module.
//
// This repo's PRIMARY artifact is the Next.js cap-table application. This tiny
// Go module exists ONLY so the unified hanzoai/cloud binary (HIP-0106) can embed
// the captable goja bundle (goja/bundle.js) — the self-contained, ESM-free port
// of the tRPC business logic — WITHOUT copying it into the cloud repo. Cloud
// imports github.com/hanzoai/captable and gets Bundle().
//
// std-lib only — no third-party Go deps. The TypeScript in goja/src stays the
// single source of truth; the Go layer is a read-only embed, exactly like
// github.com/hanzoai/plans.
module github.com/hanzoai/captable

go 1.26.4
