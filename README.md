# DarkOps

**Find the cause. Fix the loss.**

DarkOps is an operations intelligence prototype for quick-commerce dark stores. It surfaces wastage, expiry, inventory and returns signals, then connects them to evidence and practical next steps. The prototype uses fictional Bengaluru store data: four stores, 40 products and 56 daily periods, with planted operating patterns. Actions and post-action verification are simulated; it does not connect to live store systems.

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

Open [http://localhost:8000](http://localhost:8000). The API is also available at `/api/overview` and `/api/issues`; interactive API docs are at `/docs`.

Regenerate the CSV tables with the default seed and current date:

```bash
python3 -m data.generator.generate
```

For a repeatable historical snapshot, pin both the seed and final date:

```bash
python3 -m data.generator.generate --seed 17017 --as-of 2026-10-17
```

## First demo flow

1. Review the operational overview and highest-impact cases.
2. Open an investigation to see the signal, supporting metrics, hypotheses and recommendation.
3. Record a simulated action.
4. Run the simulated seven-day check to compare the follow-up period.

Generated tables include stores, products, daily inventory and sales, purchase receipts, wastage events, returns, and weekly cycle counts. The API calculates issue metrics from those records: wastage against a four-week baseline, near-expiry stock, cycle-count variance, and return-rate changes. Each case lists the CSV tables used as its evidence. The prototype uses transparent rules rather than claiming an unconfigured AI integration.

## Structure

```text
frontend/             Static React-free prototype UI (HTML, CSS, JavaScript)
backend/app/           FastAPI API and deterministic demo data
data/generator/        Seeded synthetic CSV generator
data/samples/          Generated CSV tables and manifest
docs/                  Product and architecture notes
```

## Next milestones

1. Expand the deterministic detectors and add user-selected investigation scopes.
2. Add a Gemini investigation service that receives bounded evidence from the API.
3. Persist case actions and history (Firestore or a local database for development).
4. Add manager approval and Cloud Run deployment.

All records, amounts, stores, and verification outcomes shown in this demo are synthetic.
