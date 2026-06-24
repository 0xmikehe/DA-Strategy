# P2-2 Remote Exporter Design

## Goal

Export normalized, redacted ledger facts from the remote runtime for local development and regression testing.

The exporter is project-owned. It is not a Binance proxy and does not expose arbitrary Binance paths.

## Responsibilities

The remote exporter:

- Selects export scope by sync run, time window, or latest successful sync.
- Reads normalized ledger facts from the remote database.
- Redacts sensitive fields.
- Builds a `ledger_export_package`.
- Computes a package hash.
- Persists export metadata.
- Writes a package file or serves it through a private internal endpoint.

## Preferred Transport Order

1. Remote command writes a package file.
2. Local command pulls the file through SSH or another private channel.
3. Optional later endpoint: `GET /api/internal/ledger/exports/:export_run_id`.

No public export endpoint is allowed.

## Redaction Rules

Never export:

- API key.
- API secret.
- Signature.
- Signed query string.
- Request headers.
- Full request URL with signed parameters.
- Secret-bearing `.env` values.
- Full deposit/withdrawal addresses unless explicitly required and separately reviewed.

Default export may include `raw_payload_redacted`, but not full raw signed payloads.

## Initial Verification

- Export hash is stable for the same package content.
- Redaction test confirms no secret-like fields are present.
- Export metadata records actor, export time, scope, hash, and source environment.
- Local import rejects a tampered package.
