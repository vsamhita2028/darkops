#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-darkops-511815}"
REGION="${GOOGLE_CLOUD_REGION:-asia-south1}"
RUNTIME_SA="darkops-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  aiplatform.googleapis.com bigquery.googleapis.com firestore.googleapis.com \
  --project="$PROJECT_ID"

if ! gcloud iam service-accounts describe "$RUNTIME_SA" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create darkops-runtime \
    --project="$PROJECT_ID" \
    --display-name="DarkOps Cloud Run runtime"
fi

if ! gcloud firestore databases describe --database='(default)' --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud firestore databases create \
    --database='(default)' \
    --location="$REGION" \
    --type=firestore-native \
    --project="$PROJECT_ID"
else
  echo "Firestore database exists."
fi

for ROLE in roles/aiplatform.user roles/datastore.user roles/bigquery.jobUser roles/bigquery.dataViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="$ROLE" \
    --condition=None \
    --quiet
done

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
BUILD_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${BUILD_SA}" \
  --role=roles/run.builder \
  --condition=None \
  --quiet

echo "Runtime identity: ${RUNTIME_SA}"
echo "This grants project-scoped AI, Firestore, and BigQuery access. Review project IAM before running in production."
