"""Optional Google Cloud adapters, authenticated through ADC (no key files)."""

from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "darkops-511815").strip()
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "global").strip()
BIGQUERY_LOCATION = os.getenv("BIGQUERY_LOCATION", "asia-south1").strip()
BIGQUERY_DATASET = os.getenv("BIGQUERY_DATASET", "darkops_demo").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite").strip()
USE_FIRESTORE = os.getenv("DARKOPS_USE_FIRESTORE", "false").lower() in {"1", "true", "yes"}
USE_BIGQUERY = os.getenv("DARKOPS_USE_BIGQUERY", "false").lower() in {"1", "true", "yes"}


def _client_error(name: str, exc: Exception) -> HTTPException:
    return HTTPException(status_code=503, detail=f"{name} is not available: {exc.__class__.__name__}. Check ADC and the runtime service account roles.")


def get_bigquery_client():
    if not PROJECT_ID:
        raise HTTPException(status_code=503, detail="Set GOOGLE_CLOUD_PROJECT to connect BigQuery.")
    try:
        from google.cloud import bigquery
        return bigquery.Client(project=PROJECT_ID)
    except Exception as exc:
        raise _client_error("BigQuery", exc) from exc


def get_firestore_client():
    if not PROJECT_ID:
        raise HTTPException(status_code=503, detail="Set GOOGLE_CLOUD_PROJECT to connect Firestore.")
    try:
        from google.cloud import firestore
        return firestore.Client(project=PROJECT_ID)
    except Exception as exc:
        raise _client_error("Firestore", exc) from exc


def get_vertex_client():
    if not PROJECT_ID:
        raise HTTPException(status_code=503, detail="Set GOOGLE_CLOUD_PROJECT to connect Vertex AI.")
    try:
        from google import genai
        return genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)
    except Exception as exc:
        raise _client_error("Vertex AI", exc) from exc


def analyze_with_gemini(issue: dict[str, Any]) -> dict[str, Any]:
    """Ask Gemini to explain the supplied facts; keep calculated metrics authoritative."""
    client = get_vertex_client()
    try:
        from google.genai.types import GenerateContentConfig
        prompt = """You are DarkOps, an operations analyst for fictional dark stores.
Use only the supplied evidence. Do not invent counts, dates, prices, causes, or confidence probabilities.
The calculated financial impact and measured facts are fixed inputs. You may give a qualitative likely cause and practical actions.
Return JSON only with keys: likely_root_cause (string), explanation (string), alternative_explanations (array of strings), recommended_actions (array of strings), evidence_gaps (array of strings).

CASE EVIDENCE:\n""" + json.dumps({key: issue.get(key) for key in ("id", "title", "category", "store", "product", "impact", "units", "signal", "evidence", "hypotheses", "evidence_refs")}, ensure_ascii=False)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=GenerateContentConfig(response_mime_type="application/json", temperature=0.2, max_output_tokens=900),
        )
        result = json.loads(response.text or "{}")
        required = {"likely_root_cause", "explanation", "alternative_explanations", "recommended_actions", "evidence_gaps"}
        if not required.issubset(result):
            raise ValueError("Model response did not include the required investigation fields")
        result["model"] = GEMINI_MODEL
        result["source"] = "Vertex AI Gemini"
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise _client_error("Vertex AI investigation", exc) from exc


def persist_case(issue: dict[str, Any]) -> None:
    if not USE_FIRESTORE:
        return
    client = get_firestore_client()
    try:
        client.collection("darkops_cases").document(issue["id"]).set({
            "issue_id": issue["id"], "status": issue["status"],
            "action_record": issue.get("action_record"), "gemini_investigation": issue.get("gemini_investigation"),
            "verified_at": issue.get("verified_at"), "updated_at": issue.get("updated_at"),
        }, merge=True)
    except HTTPException:
        raise
    except Exception as exc:
        raise _client_error("Firestore write", exc) from exc


def load_case_overrides() -> dict[str, dict]:
    if not USE_FIRESTORE:
        return {}
    client = get_firestore_client()
    try:
        return {snapshot.id: snapshot.to_dict() or {} for snapshot in client.collection("darkops_cases").stream()}
    except Exception as exc:
        raise _client_error("Firestore read", exc) from exc


def cloud_status() -> dict[str, Any]:
    return {
        "project_id": PROJECT_ID or None,
        "location": LOCATION,
        "vertex_ai": {"configured": bool(PROJECT_ID), "model": GEMINI_MODEL, "trigger": "manual per investigation"},
        "bigquery": {"configured": bool(PROJECT_ID), "dataset": BIGQUERY_DATASET, "active_data_backend": "bigquery" if USE_BIGQUERY else "csv", "purpose": "synthetic operations analytics tables"},
        "firestore": {"configured": bool(PROJECT_ID and USE_FIRESTORE), "collection": "darkops_cases" if USE_FIRESTORE else None},
        "authentication": "Application Default Credentials",
    }
