# Ledger Overview And Account Scope Design

## Goal

The ledger page should serve the common daily workflow first: understand current holdings and inspect history by account. Exception handling remains available, but it should not dominate the first screen.

## Information Architecture

The page has two modes.

- `all` scope: summary-only overview. It shows total tracked value, account/wallet counts, asset coverage, reconciliation issue count, pending attribution count, per-account entry cards, and a short recent activity preview.
- `account` scope: account workbench. It shows the selected account's holdings, ledger history, reconciliation rows, pending attribution rows, binding health summary, and folded exception actions.

The scope selector is the top-level control. `全部账户总览` is the default. Account entries link to `/ledger?account=<accountId>`.

## Valuation Rule

The ledger page values only assets that the system explicitly tracks for strategy/market context. In the offline page loop, the tracked display universe is BTC, ETH, and USDT:

- BTC and ETH use fixture-aligned tracked market prices.
- USDT uses a stablecoin peg for display.
- Any other asset keeps quantity and account coverage, but shows `unpriced` and does not enter total value.

This avoids implying that mock or cassette coverage has complete portfolio pricing.

## Page Model Contract

`LedgerPageModel` exposes:

- `selectedScope`: current `all` or account scope.
- `portfolioSummary`: overview metrics, asset rows, account entry cards, and recent flow preview.
- Scoped `currentPositions`, `reconciliation`, `pendingAttribution`, and `flows` for the selected account view.

The React components should render from this model directly and should not infer business state from raw facts.

## Verification

The change is covered by:

- page-model tests for empty state, overview totals, account options, and selected-account filtering;
- static render tests for the summary-first ledger page;
- Playwright coverage for default overview and account drill-in.
