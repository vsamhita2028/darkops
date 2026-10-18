from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
import os

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form, Body, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token as google_id_token

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
from backend.app.forensics import forensics_agent, ForensicResult

ROOT = Path(__file__).resolve().parents[2]
DATA = OperationsData()

PHOTO_MAPPING = {
    "DO-2048": {
        "complaint_photo": "/complaints/rotten_staples_1.jpg",
        "complaint_text": "Tomatoes arrived rotten, squishy, and mouldy straight out of the delivery bag. Unusable.",
        "scenario": "Scenario 1: Bad Supplier Batch (B-4471)",
    },
    "DO-2047": {
        "complaint_photo": "/complaints/expired_staples_1.jpg",
        "complaint_text": "Farm fresh milk packet had an expiry date of today and tasted sour. Chilling breach.",
        "scenario": "Scenario: Near-Expiry Exposure & Temperature Breach",
    },
    "DO-2046": {
        "complaint_photo": "/complaints/crushed_staples_1.jpg",
        "complaint_text": "Atta bag seam tore during packing; flour leaked inside customer carry bag.",
        "scenario": "Scenario 4: Packing Station Mechanical Handling",
    },
    "DO-2045": {
        "complaint_photo": "/complaints/crushed_fresh_produce_1.jpg",
        "complaint_text": "Leaves are wilted and slimy inside sealed packet. Lot SP-884.",
        "scenario": "Scenario 1: Supplier Batch Quality Spike",
    },
    "DO-2044": {
        "complaint_photo": "/complaints/no_defect_bakery_1.jpg",
        "complaint_text": "Prepared paneer wrap packaging shows excessive condensation.",
        "scenario": "Scenario 6: Demand Dip / Potential Red Herring",
    },
}

EXTRA_SCENARIOS = [
    {
        "id": "DO-2049",
        "title": "Melted ice cream refund spike across stores",
        "product": "Amul Chocobar · 70 ml",
        "category": "Cold chain",
        "store": "Koramangala",
        "store_code": "BLR-02",
        "impact": 9450,
        "units": "42 refunds",
        "severity": "High",
        "status": "Investigating",
        "age": "12 min ago",
        "icon": "🍦",
        "color": "blue",
        "summary": "42 customers reported completely melted ice cream upon doorstep arrival across Store A and Store B.",
        "signal": "Refund rate jumped from 0.8% to 14.2% across peak afternoon delivery hours.",
        "complaint_photo": "/complaints/melted_dairy_frozen_1.jpg",
        "complaint_text": "The ice cream was completely liquid. Packaging was sticky and leaking.",
        "scenario": "Scenarios 2 & 3: Failing Freezer vs Slow Zone in Heat",
        "evidence": [
            {"label": "Store A (Koramangala)", "value": "-8°C drift", "note": "Freezer F2 temperature sensor", "direction": "bad"},
            {"label": "Store B (Indiranagar)", "value": "22 min route", "note": "Zone 3 delivery in 38°C heat", "direction": "bad"},
            {"label": "Batch quality", "value": "Normal", "note": "Whitefield store had 0 melt claims", "direction": "good"},
        ],
        "hypotheses": [
            {"name": "Store A: Chiller Compressor Drift", "score": 88, "detail": "Freezer F2 rose from -18°C to -8°C between 13:00 and 16:30."},
            {"name": "Store B: Last-Mile Heat Exposure", "score": 84, "detail": "Deliveries to Zone 3 exceeded 18 minutes in 38°C ambient afternoon traffic."},
            {"name": "Supplier batch defect", "score": 12, "detail": "Same batch IC-9821 delivered to Whitefield had 0 complaints."},
        ],
        "recommendation": "Store A: Raise urgent technician maintenance ticket for Freezer F2. Store B: Enforce thermal insulated delivery pouches for Zone 3.",
        "verification": {"before": 42, "after": 3, "unit": "refunds", "period": "7 days", "source": "Post-maintenance & thermal pouch verification"},
    },
    {
        "id": "DO-2050",
        "title": "Recycled photo refund abuse across multiple accounts",
        "product": "Dark Chocolate Slab · 100 g",
        "category": "Refund fraud",
        "store": "Indiranagar",
        "store_code": "BLR-04",
        "impact": 4800,
        "units": "9 repeat claims",
        "severity": "High",
        "status": "Action needed",
        "age": "5 min ago",
        "icon": "🚨",
        "color": "red",
        "summary": "Vertex AI Multimodal Embeddings flagged 9 refund claims reusing near-identical photos across 3 customer accounts.",
        "signal": "98.4% perceptual vector match between claims filed under distinct mobile numbers.",
        "complaint_photo": "/complaints/abuse/abuse_claim_2.jpg",
        "complaint_text": "Chocolate arrived melted and squished. Please refund immediately to UPI.",
        "scenario": "Scenario 5: Refund Abuse (Reused Photo)",
        "evidence": [
            {"label": "Embedding match", "value": "98.4%", "note": "Vertex AI Vector Search", "direction": "bad"},
            {"label": "Accounts involved", "value": "3 accounts", "note": "shared device fingerprint & IP subnet", "direction": "bad"},
            {"label": "Prior refunds", "value": "₹4,800", "note": "across 9 claims in 14 days", "direction": "bad"},
        ],
        "hypotheses": [
            {"name": "Coordinated Refund Abuse", "score": 98, "detail": "Near-identical cropped photos submitted from different accounts within minutes."},
            {"name": "Legitimate coincidence", "score": 2, "detail": "Chance of identical visual noise across independent camera captures is < 0.001%."},
        ],
        "recommendation": "Auto-hold pending refunds; block promotional refund eligibility on flagged device fingerprint.",
        "verification": {"before": 9, "after": 0, "unit": "fraud claims", "period": "7 days", "source": "Automated account hold enforcement"},
    },
]

def load_initial_issues():
    rows = [dict(issue) for issue in DATA.issues]
    for row in rows:
        mapping = PHOTO_MAPPING.get(row["id"], {})
        row["complaint_photo"] = mapping.get("complaint_photo", "/complaints/rotten_staples_1.jpg")
        row["complaint_text"] = mapping.get("complaint_text", row.get("signal", ""))
        row["scenario"] = mapping.get("scenario", "Operational Anomaly")
    # Add extra scenarios
    rows.extend(EXTRA_SCENARIOS)
    if USE_FIRESTORE:
        for issue_id, saved in load_case_overrides().items():
            issue = next((item for item in rows if item["id"] == issue_id), None)
            if issue:
                for field in ("status", "action_record", "gemini_investigation", "verified_at", "updated_at", "forensics"):
                    if field in saved:
                        issue[field] = saved[field]
    return rows

ISSUES = load_initial_issues()
app = FastAPI(title="DarkOps API", version="0.2.0", description="Evidence-backed dark-store operations demo")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_google_id_token(token: str) -> dict:
    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured.")
    try:
        claims = google_id_token.verify_oauth2_token(token, GoogleAuthRequest(), client_id)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Google sign-in is invalid or expired. Please sign in again.") from exc
    if not claims.get("sub") or not claims.get("email") or not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google did not verify this account's email address.")
    return claims


@app.middleware("http")
async def require_google_login(request: Request, call_next):
    path = request.url.path
    public_api_paths = {"/api/health", "/api/auth/config", "/api/auth/session", "/api/auth/logout"}
    if path.startswith("/api/") and path not in public_api_paths:
        token = request.cookies.get("darkops_google_session", "")
        if not token:
            return JSONResponse({"detail": "Sign in with Google to continue."}, status_code=401)
        try:
            request.state.google_user = verify_google_id_token(token)
        except HTTPException as exc:
            return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
    return await call_next(request)


class ActionInput(BaseModel):
    action: str = Field(min_length=3, max_length=180)
    owner: str = Field(default="Store manager", max_length=80)


@app.get("/api/health")
def health():
    return {"application": "DarkOps", "status": "running", "environment": "synthetic-demo", "data_as_of": DATA.last_date.isoformat()}


@app.get("/api/profile")
def profile(request: Request):
    """Return the name and email from the verified Google sign-in token."""
    user = request.state.google_user
    return {"display_name": user.get("name") or user.get("given_name") or "Google User",
            "email": user["email"], "picture": user.get("picture", ""), "authenticated": True}


class GoogleCredential(BaseModel):
    credential: str = Field(min_length=100, max_length=8192)


@app.get("/api/auth/config")
def google_auth_config():
    return {"client_id": os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "").strip()}


@app.post("/api/auth/session")
def google_auth_session(payload: GoogleCredential, response: Response, request: Request):
    """Validate a Google Sign-In ID token before the browser starts an app session."""
    claims = verify_google_id_token(payload.credential)
    response.set_cookie(
        key="darkops_google_session",
        value=payload.credential,
        httponly=True,
        secure=request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https",
        samesite="lax",
        max_age=3600,
        path="/",
    )
    return {
        "display_name": claims.get("name") or claims.get("given_name") or "Google User",
        "email": claims["email"],
        "picture": claims.get("picture", ""),
        "authenticated": True,
    }


@app.post("/api/auth/logout")
def google_auth_logout(response: Response, request: Request):
    response.delete_cookie(
        "darkops_google_session", path="/", httponly=True,
        secure=request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https",
        samesite="lax",
    )
    return {"signed_out": True}


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


# --- GEMINI MULTIMODAL FORENSICS ENDPOINTS ---

SAMPLE_PHOTOS = [
    {
        "id": "sample-tomato-rot",
        "title": "Tomato Rot Spike (Supplier Batch B-4471)",
        "scenario": "Scenario 1: Bad Supplier Batch",
        "product": "Local tomatoes · 1 kg",
        "complaint_text": "Tomatoes arrived rotten, squishy, and mouldy straight out of the delivery bag.",
        "path": "complaints/rotten_staples_1.jpg",
        "url": "/complaints/rotten_staples_1.jpg",
        "expected_defect": "Mouldy / Rot",
        "batch_code": "B-4471",
    },
    {
        "id": "sample-icecream-melt",
        "title": "Melted Ice Cream (Freezer F2 vs Hot Zone 3)",
        "scenario": "Scenarios 2 & 3: Cold-Chain Breaches",
        "product": "Amul Chocobar · 70 ml",
        "complaint_text": "Ice cream was completely melted into liquid soup upon delivery. Unacceptable!",
        "path": "complaints/melted_dairy_frozen_1.jpg",
        "url": "/complaints/melted_dairy_frozen_1.jpg",
        "expected_defect": "Melted",
        "batch_code": "IC-9821",
    },
    {
        "id": "sample-crushed-pack",
        "title": "Crushed Eggs & Broken Pack",
        "scenario": "Scenario 4: Packing Station Mechanical Failure",
        "product": "Farm eggs · 6 pack",
        "complaint_text": "Carton was crushed inside the bag, egg shells smashed and leaking everywhere.",
        "path": "complaints/crushed_fresh_produce_1.jpg",
        "url": "/complaints/crushed_fresh_produce_1.jpg",
        "expected_defect": "Crushed / Damaged",
        "batch_code": "EG-1104",
    },
    {
        "id": "sample-expired-dairy",
        "title": "Expired Milk (FIFO Picking Error)",
        "scenario": "Near-Expiry Exposure",
        "product": "Farm fresh milk · 500 ml",
        "complaint_text": "Milk was delivered with today's expiry date and smelled sour immediately.",
        "path": "complaints/expired_staples_1.jpg",
        "url": "/complaints/expired_staples_1.jpg",
        "expected_defect": "Expired",
        "batch_code": "MK-8820",
    },
    {
        "id": "sample-abuse-claim-1",
        "title": "Original Claim (Customer A)",
        "scenario": "Scenario 5: Refund Abuse (Base Photo)",
        "product": "Dark Chocolate Slab · 100 g",
        "complaint_text": "Chocolate melted and crushed in heat.",
        "path": "complaints/abuse/abuse_claim_6.jpg",
        "url": "/complaints/abuse/abuse_claim_6.jpg",
        "claim_id": "CLM-ABUSE-106",
        "expected_defect": "Melted",
        "batch_code": "CH-5512",
    },
    {
        "id": "sample-abuse-claim-2",
        "title": "Duplicate Photo Claim (Customer B)",
        "scenario": "Scenario 5: Refund Abuse (Reused Photo)",
        "product": "Dark Chocolate Slab · 100 g",
        "complaint_text": "Chocolate melted. Need refund to UPI.",
        "path": "complaints/abuse/abuse_claim_7.jpg",
        "url": "/complaints/abuse/abuse_claim_7.jpg",
        "claim_id": "CLM-ABUSE-107",
        "expected_defect": "Duplicate Claim Photo (Abuse)",
        "batch_code": "CH-5512",
    },
    {
        "id": "sample-no-defect",
        "title": "Bread Order (Customer False Alarm)",
        "scenario": "Scenario 6: Red Herring (No Defect)",
        "product": "Brown bread · 400 g",
        "complaint_text": "Customer claimed bread was stale, but seal is intact.",
        "path": "complaints/no_defect_bakery_1.jpg",
        "url": "/complaints/no_defect_bakery_1.jpg",
        "expected_defect": "No Defect Found",
        "batch_code": "BR-9011",
    },
]


@app.get("/api/forensics/samples")
def list_forensic_samples():
    """Returns preset complaint photos for testing Gemini photo forensics."""
    return SAMPLE_PHOTOS


@app.post("/api/forensics/analyze-sample")
async def analyze_sample_photo(payload: dict = Body(...)):
    """Runs Gemini multimodal forensics on a preset sample image."""
    sample_id = payload.get("sample_id")
    sample = next((s for s in SAMPLE_PHOTOS if s["id"] == sample_id), None)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample photo not found")

    image_path = ROOT / "frontend" / sample["path"]
    if not image_path.exists():
        raise HTTPException(status_code=404, detail=f"Image file missing on disk: {sample['path']}")

    image_bytes = image_path.read_bytes()
    result = await forensics_agent.analyze_photo(
        image_bytes=image_bytes,
        filename=image_path.name,
        complaint_text=sample.get("complaint_text", ""),
        product_name=sample.get("product", ""),
        claim_id=sample.get("claim_id", sample.get("id")),
        customer_id=payload.get("customer_id", "CUST-DEMO"),
    )
    return {"sample": sample, "forensic_result": result.model_dump()}


@app.post("/api/forensics/analyze-upload")
async def analyze_uploaded_photo(
    file: UploadFile = File(...),
    complaint_text: str = Form(""),
    product_name: str = Form(""),
    claim_id: str = Form(None),
    customer_id: str = Form("CUST-LIVE"),
):
    """Runs Gemini multimodal forensics on any user-uploaded image."""
    image_bytes = await file.read()
    result = await forensics_agent.analyze_photo(
        image_bytes=image_bytes,
        filename=file.filename or "upload.jpg",
        complaint_text=complaint_text,
        product_name=product_name,
        claim_id=claim_id,
        customer_id=customer_id,
    )
    return {"filename": file.filename, "forensic_result": result.model_dump()}


@app.post("/api/issues/{issue_id}/forensics")
async def run_issue_forensics(issue_id: str):
    """Runs or retrieves forensics for a specific operational investigation case."""
    issue = next((item for item in ISSUES if item["id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Investigation not found")

    photo_path = issue.get("complaint_photo")
    if not photo_path:
        # Default assignment if not already mapped
        photo_path = "/complaints/rotten_staples_1.jpg"

    clean_path = photo_path.lstrip("/")
    image_path = ROOT / "frontend" / clean_path
    if not image_path.exists():
        image_bytes = b""
    else:
        image_bytes = image_path.read_bytes()

    result = await forensics_agent.analyze_photo(
        image_bytes=image_bytes,
        filename=image_path.name,
        complaint_text=issue.get("complaint_text", issue.get("signal", "")),
        product_name=issue.get("product", ""),
        claim_id=issue["id"],
    )
    issue["forensics"] = result.model_dump()
    return {"issue_id": issue_id, "forensic_result": result.model_dump()}


app.mount("/", StaticFiles(directory=ROOT / "frontend", html=True), name="frontend")
