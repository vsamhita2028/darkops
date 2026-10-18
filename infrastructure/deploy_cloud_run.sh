#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-darkops-511815}"
REGION="${GOOGLE_CLOUD_REGION:-asia-south1}"
SERVICE="${CLOUD_RUN_SERVICE:-darkops}"
RUNTIME_SA="darkops-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud run deploy "$SERVICE" \
  --source . \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --service-account="$RUNTIME_SA" \
  --allow-unauthenticated \
  --no-iap \
  --min=0 \
  --max=2 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60 \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=global,GOOGLE_OAUTH_CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID:-},BIGQUERY_LOCATION=${REGION},BIGQUERY_DATASET=darkops_demo,DARKOPS_USE_FIRESTORE=true,GOOGLE_GENAI_USE_VERTEXAI=true,GEMINI_MODEL=gemini-3.1-flash-lite"

gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)'
