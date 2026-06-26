# P2-5 Manual Fallback Writes

This phase defines external trade entry, attribution, and reversal flows.

All manual fallback writes must go through `appendLedgerFacts()` and preserve append-only ledger semantics.

Canonical files for this phase:

- `design.md` - manual fallback write design.
- `plan.md` - P2-5 implementation plan.
- `verification.md` - create during implementation to record evidence.
