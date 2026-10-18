from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.app.data_service import OperationsData
from backend.app.google_cloud import (
    BIGQUERY_DATASET,
    PROJECT_ID,
    USE_FIRESTORE,
    analyze_with_gemini,
    cloud_status,
    get_bigquery_client,
    load_case_overrides,
    persist_case,
)

ROOT = Path(__file__).resolve().parents[2]
DATA = OperationsData()
ISSUES = [dict(issue) for issue in DATA.issues]
if USE_FIRESTORE:
    for issue_id, saved in load_case_overrides().items():
        issue = next((item for item in ISSUES if item["id"] == issue_id), None)
        if issue:
            for field in ("status", "action_record", "gemini_investigation", "verified_at", "updated_at"):
                if field in saved:
                    issue[field] = saved[field]
app = FastAPI(title="DarkOps API", version="0.2.0", description="Evidence-backed dark-store operations demo")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ActionInput(BaseModel):
    action: str = Field(min_length=3, max_length=180)
    owner: str = Field(default="Store manager", max_length=80)


@app.get("/api/health")
def health():
    return {"application": "DarkOps", "status": "running", "environment": "synthetic-demo", "data_as_of": DATA.last_date.isoformat()}


@app.get("/api/dataset")
def dataset_summary():
    return DATA.summary()


@app.get("/api/cloud/status")
def google_cloud_status():
    return cloud_status()


@app.get("/api/cloud/bigquery/tables")
def bigquery_tables():
    if not PROJECT_ID:
        raise HTTPException(status_code=503, detail="Set GOOGLE_CLOUD_PROJECT to connect BigQuery.")
    client = get_bigquery_client()
    dataset_id = f"{PROJECT_ID}.{BIGQUERY_DATASET}"
    try:
        dataset = client.get_dataset(dataset_id)
        tables = [{"name": table.table_id, "rows": client.get_table(table).num_rows} for table in client.list_tables(dataset)]
        return {"project": PROJECT_ID, "dataset": BIGQUERY_DATASET, "location": dataset.location, "tables": tables}
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=503, detail=f"BigQuery dataset unavailable: {exc.__class__.__name__}. Run `python -m backend.app.sync_bigquery` and check ADC/IAM.") from exc


@app.get("/api/overview")
def overview(store: str | None = Query(default=None)):
    result = DATA.overview(store)
    filtered = [issue for issue in ISSUES if not store or issue["store"] == store]
    result["metrics"]["active_cases"] = len([issue for issue in filtered if issue["status"] != "Verified"])
    result["metrics"]["loss_at_risk"] = sum(issue["impact"] for issue in filtered)
    return result


@app.get("/api/issues")
def list_issues(category: str | None = None, store: str | None = None, q: str | None = None):
    rows = ISSUES
    if category and category.lower() != "all":
        rows = [issue for issue in rows if issue["category"].lower() == category.lower()]
    if store:
        rows = [issue for issue in rows if issue["store"] == store or issue["store_code"] == store]
    if q:
        term = q.lower()
        rows = [issue for issue in rows if term in " ".join(str(issue.get(key, "")) for key in ("id", "title", "product", "store", "category")).lower()]
    return rows


@app.get("/api/issues/{issue_id}")
def get_issue(issue_id: str):
    issue = next((item for item in ISSUES if item["id"] == issue_id), None)
    if issue is None:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return issue


@app.post("/api/issues/{issue_id}/investigate")
def investigate_issue(issue_id: str):
    issue = next((item for item in ISSUES if item["id"] == issue_id), None)
    if issue is None:
        raise HTTPException(status_code=404, detail="Investigation not found")
    result = analyze_with_gemini(issue)
    issue["gemini_investigation"] = result
    issue["updated_at"] = datetime.now().isoformat(timespec="minutes")
    persist_case(issue)
    return issue


@app.post("/api/issues/{issue_id}/action")
def record_action(issue_id: str, payload: ActionInput):
    issue = next((item for item in ISSUES if item["id"] == issue_id), None)
    if issue is None:
        raise HTTPException(status_code=404, detail="Investigation not found")
    issue["status"] = "Action recorded"
    issue["action_record"] = {
        "action": payload.action,
        "owner": payload.owner,
        "recorded_at": datetime.now().isoformat(timespec="minutes"),
        "simulated": True,
    }
    issue["updated_at"] = datetime.now().isoformat(timespec="minutes")
    persist_case(issue)
    return issue


@app.post("/api/issues/{issue_id}/verify")
def verify_issue(issue_id: str):
    issue = next((item for item in ISSUES if item["id"] == issue_id), None)
    if issue is None:
        raise HTTPException(status_code=404, detail="Investigation not found")
    if "action_record" not in issue:
        raise HTTPException(status_code=409, detail="Record an action before running verification")
    issue["status"] = "Verified"
    issue["verified_at"] = date.today().isoformat()
    issue["updated_at"] = datetime.now().isoformat(timespec="minutes")
    persist_case(issue)
    return issue


@app.get("/api/stores")
def list_stores():
    return DATA.stores


app.mount("/", StaticFiles(directory=ROOT / "frontend", html=True), name="frontend")
