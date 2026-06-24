# P2-5 Manual Fallback Writes

This phase will define external trade entry, attribution, and reversal flows.

All manual fallback writes must go through `appendLedgerFacts()` and preserve append-only ledger semantics.

Canonical files for this phase:

- `design.md` - create when the manual fallback design is ready for review.
- `plan.md` - create after design approval.
- `verification.md` - create during implementation to record evidence.
