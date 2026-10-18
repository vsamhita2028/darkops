"""Load the generated CSV tables into the configured BigQuery dataset."""

from __future__ import annotations

from pathlib import Path

from google.api_core.exceptions import NotFound
from backend.app.google_cloud import BIGQUERY_DATASET, BIGQUERY_LOCATION, PROJECT_ID, get_bigquery_client
from backend.app.data_service import SAMPLE_DIR

TABLES = ("stores", "products", "daily_operations", "sales", "purchases", "wastage", "returns", "cycle_counts")


def sync() -> None:
    if not PROJECT_ID:
        raise SystemExit("Set GOOGLE_CLOUD_PROJECT before syncing.")
    client = get_bigquery_client()
    dataset_id = f"{PROJECT_ID}.{BIGQUERY_DATASET}"
    try:
        client.get_dataset(dataset_id)
        print(f"Using existing dataset {dataset_id}")
    except NotFound:
        from google.cloud import bigquery
        dataset = bigquery.Dataset(dataset_id)
        dataset.location = BIGQUERY_LOCATION
        dataset.description = "Synthetic DarkOps demonstration tables"
        dataset.labels = {"application": "darkops", "environment": "demo"}
        client.create_dataset(dataset, exists_ok=True)
        print(f"Created dataset {dataset_id} in {BIGQUERY_LOCATION}")

    from google.cloud import bigquery
    for table_name in TABLES:
        source = SAMPLE_DIR / f"{table_name}.csv"
        if not source.is_file():
            raise FileNotFoundError(f"Missing generated CSV table: {source}")
        table_id = f"{dataset_id}.{table_name}"
        job_config = bigquery.LoadJobConfig(
            source_format=bigquery.SourceFormat.CSV,
            skip_leading_rows=1,
            autodetect=True,
            write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        )
        with source.open("rb") as file:
            job = client.load_table_from_file(file, table_id, job_config=job_config)
        job.result()
        table = client.get_table(table_id)
        print(f"Loaded {table.num_rows:,} rows → {table_id}")


if __name__ == "__main__":
    sync()
