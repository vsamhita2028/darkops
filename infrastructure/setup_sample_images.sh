#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-darkops-511815}"
REGION="${GOOGLE_CLOUD_REGION:-asia-south1}"
BUCKET="${DARKOPS_SAMPLE_IMAGE_BUCKET:-${PROJECT_ID}-demo-images}"
RUNTIME_SA="darkops-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
PYTHON_BIN="${DARKOPS_PYTHON:-python3}"
if [[ -x .venv/bin/python ]]; then
  PYTHON_BIN="${DARKOPS_PYTHON:-.venv/bin/python}"
fi

gcloud services enable storage.googleapis.com --project="$PROJECT_ID"

if ! gcloud storage buckets describe "gs://${BUCKET}" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --uniform-bucket-level-access
fi

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role=roles/storage.objectViewer

# Cloud Run also accepts uploaded forensic evidence. Keep write access scoped to
# this bucket, and grant only object creation; existing images remain private.
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role=roles/storage.objectCreator

gcloud storage cp frontend/complaints/demo-*.jpg "gs://${BUCKET}/demo/" \
  --cache-control="private,max-age=3600"

GOOGLE_CLOUD_PROJECT="$PROJECT_ID" \
DARKOPS_SAMPLE_IMAGE_BUCKET="$BUCKET" \
DARKOPS_USE_FIRESTORE=true \
"$PYTHON_BIN" -m backend.app.seed_sample_images

echo "Sample images and metadata configured in gs://${BUCKET} and Firestore collection darkops_sample_images (private; runtime access: ${RUNTIME_SA})"
