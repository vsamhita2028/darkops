# DarkOps

**Find the cause. Fix the loss.**

DarkOps is an operations intelligence prototype for quick-commerce dark stores. It surfaces wastage, expiry, inventory and returns signals, then connects them to evidence and practical next steps. The demo uses fictional Bengaluru store data: four stores, 40 products and 56 daily periods, with planted operating patterns. In the deployed app, BigQuery supplies the operations tables, Firestore persists case workflow, and Vertex AI Gemini runs user-requested investigations and photo forensics. Actions and post-action verification are simulated; it does not connect to live store systems.

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

## Google Cloud integrations

The project is configured for Google Cloud project `darkops-511815`. The app uses Application Default Credentials locally and a dedicated runtime service account on Cloud Run; do not create or commit service account keys.

1. Copy `.env.example` to `.env` if you want to override defaults, then authenticate locally with `gcloud auth application-default login`.
2. Run `bash infrastructure/setup_gcp.sh` to enable required APIs, create the runtime service account if needed, and grant it Vertex AI, Firestore, and BigQuery read/job roles. The script reports if a Firestore database must be created; select/confirm its location before creating it.
3. Copy the synthetic CSV tables into BigQuery with `python -m backend.app.sync_bigquery`. This creates dataset `darkops_demo` if missing and replaces the eight demo tables on each sync. The deployed service sets `DARKOPS_USE_BIGQUERY=true`, so its API loads the operations rows from those BigQuery tables. Local runs use CSV by default; set the flag to `true` to use BigQuery locally.
4. Deploy the Cloud Run service with `bash infrastructure/deploy_cloud_run.sh`. The web shell is reachable so it can present Google sign-in; business API routes require a verified Google ID token held in a short-lived, HttpOnly session cookie. Public auth bootstrap endpoints expose only the OAuth client ID and accept sign-in/logout requests. The runtime continues to use its dedicated service account, scales to zero, and caps at two instances.

Google sign-in uses a **Web application** OAuth client. Add each exact local origin you use to its authorized JavaScript origins (for example, `http://localhost:8000` and `http://127.0.0.1:8001` are different origins), plus the deployed app origin. Set `GOOGLE_OAUTH_CLIENT_ID` in `.env` locally and in the shell before running the deploy script. The sign-in request includes the standard `openid email profile` identity scopes; the backend verifies the Google ID token's signature and audience before creating a one-hour HttpOnly session cookie. The verified Google profile name is displayed as soon as login completes.

Case investigation and visual defect/OCR forensics call Vertex AI Gemini only when a user requests analysis; model usage can incur charges. Duplicate-photo comparison currently uses an in-process perceptual hash (dHash), not Vertex AI Vector Search. Firestore is enabled on the deployed service for case workflow persistence. Locally it remains disabled unless `DARKOPS_USE_FIRESTORE=true` is set. The dashboard still calculates its deterministic metrics in the Python API, using rows loaded from BigQuery in the deployed service; CSV remains the reproducible local/demo source.

## First demo flow

1. Review the operational overview and highest-impact cases.
2. Open an investigation to see the signal, supporting metrics, hypotheses and recommendation.
3. Record a simulated action.
4. Run the simulated seven-day check to compare the follow-up period.

Generated tables include stores, products, daily inventory and sales, purchase receipts, wastage events, returns, and weekly cycle counts. The API calculates issue metrics from those records: wastage against a four-week baseline, near-expiry stock, cycle-count variance, and return-rate changes. Each case lists the CSV tables used as its evidence. Gemini provides an optional explanation over bounded synthetic case evidence; the API-calculated metrics remain authoritative.

## Structure

```text
frontend/             Static React-free prototype UI (HTML, CSS, JavaScript)
backend/app/           FastAPI API and deterministic demo data
data/generator/        Seeded synthetic CSV generator
data/samples/          Generated CSV tables and manifest
docs/                  Product and architecture notes
```

## Cloud endpoints

- `GET /api/cloud/status` reports the configured project and integration settings.
- `GET /api/cloud/bigquery/tables` lists loaded demo tables (requires BigQuery tables and runtime permissions).
- `POST /api/issues/{issue_id}/investigate` invokes Gemini for one case.
- `POST /api/issues/{issue_id}/action` and `/verify` save workflow state to Firestore when enabled.

All records, amounts, stores, actions, and verification outcomes shown in this demo are synthetic.
