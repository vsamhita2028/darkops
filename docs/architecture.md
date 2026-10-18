# DarkOps prototype architecture

```text
Seeded generator → CSV operations tables → BigQuery demo dataset
                                         ↓
FastAPI (BigQuery row loader, deterministic detectors, and case API)
            ↓
Static operations dashboard (HTML/CSS/JavaScript)
            ↓
Manager requests Gemini analysis (Vertex AI) → records simulated action → checks simulated follow-up (Firestore)
```

The generator creates four fictional dark stores, 40 products, and 56 days of operations. It writes dimension and event tables to `data/samples/`; pass the same `--seed` and `--as-of` arguments to reproduce the same snapshot. Those rows are synchronized into BigQuery for the deployed app; local runs default to CSV. The API applies deterministic calculations for wastage, expiry, inventory variance, and returns, then renders the metrics in the frontend. User-requested investigation and image-forensics flows call Gemini through Vertex AI. Workflow changes and AI results persist in Firestore on the deployed app. All business data remains synthetic.

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
