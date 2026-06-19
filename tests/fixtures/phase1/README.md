# Phase 1 Fixtures

This directory is intentionally thin in P0.

P0 owns:

- the directory location;
- the rule that fixture data must not contain real Binance account data;
- the rule that fixture-driven tests must be deterministic and local-only.

P1 owns the first walking-skeleton fixture timeline:

- market facts;
- enabled signal set;
- decision snapshot;
- ledger events;
- planned action;
- review draft.

Do not add live API responses, account exports, API keys, or personally sensitive exchange data here.
