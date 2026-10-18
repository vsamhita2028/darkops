"""Upsert the demo photo catalog and GCS object paths into Firestore."""

from __future__ import annotations

import json
import os
from pathlib import Path

from google.cloud import firestore

from backend.app.google_cloud import PROJECT_ID, get_firestore_client


ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = ROOT / "data" / "sample_images.json"


def main() -> None:
    records = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    client = get_firestore_client()
    batch = client.batch()
    collection = client.collection("darkops_sample_images")

    for record in records:
        doc_id = record["id"]
        payload = {key: value for key, value in record.items() if key != "id"}
        payload.update({
            "sample_id": doc_id,
            "gcs_bucket": os.getenv("DARKOPS_SAMPLE_IMAGE_BUCKET", f"{PROJECT_ID}-demo-images"),
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
        batch.set(collection.document(doc_id), payload, merge=True)

    batch.commit()
    print(f"Upserted {len(records)} sample image records in {PROJECT_ID}/darkops_sample_images")


if __name__ == "__main__":
    main()
