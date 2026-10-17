# DarkOps prototype architecture

```text
Seeded generator → CSV operations tables
            ↓
FastAPI (CSV loader, deterministic detectors, and case API)
            ↓
Static operations dashboard (HTML/CSS/JavaScript)
            ↓
Manager reviews evidence → records simulated action → checks simulated follow-up
```

The generator creates four fictional dark stores, 40 products, and 56 days of operations. It writes dimension and event tables to `data/samples/`; pass the same `--seed` and `--as-of` arguments to reproduce the same snapshot. The detectors calculate wastage against a four-week baseline, near-expiry exposure, cycle-count variance, and return-rate changes from those rows. Cases include source-table references so managers can trace the summary back to its data. The frontend renders those calculated metrics. AI is intentionally not a dependency yet: a later Gemini service can interpret bounded evidence after the deterministic baseline is established.

## Current API

- `GET /api/health`
- `GET /api/dataset` (synthetic dataset date range and row counts)
- `GET /api/overview?store=Indiranagar`
- `GET /api/issues?category=Expiry%20risk&store=Koramangala&q=milk`
- `GET /api/issues/{issue_id}`
- `POST /api/issues/{issue_id}/action`
- `POST /api/issues/{issue_id}/verify`
- `GET /api/stores`

Cases and actions are in memory and reset when the server restarts. The follow-up endpoint only works after a simulated action has been recorded.
