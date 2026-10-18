"""Load the generated CSVs and turn their evidence into reviewable cases."""

from __future__ import annotations

import csv
import json
import os
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SAMPLE_DIR = ROOT / "data" / "samples"


def read_table(name: str) -> list[dict]:
    path = SAMPLE_DIR / f"{name}.csv"
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Generate the sample dataset with `python3 -m data.generator.generate`.")
    with path.open(newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def number(row: dict, key: str) -> float:
    return float(row.get(key) or 0)


def rounded(value: float, places: int = 1) -> float:
    return round(value, places)


def percent_change(current: float, baseline: float) -> float:
    if baseline <= 0:
        return 0.0 if current <= 0 else 100.0
    return (current / baseline - 1) * 100


class OperationsData:
    def __init__(self, sample_dir: Path = SAMPLE_DIR):
        self.sample_dir = sample_dir
        self.source = "bigquery" if os.getenv("DARKOPS_USE_BIGQUERY", "false").lower() in {"1", "true", "yes"} else "csv"
        self._bigquery_client = None
        if self.source == "bigquery":
            # Keep the demo's deterministic calculations, but source their rows from
            # the deployed BigQuery dataset rather than the image's bundled CSVs.
            from backend.app.google_cloud import get_bigquery_client
            self._bigquery_client = get_bigquery_client()
        self.stores = self._read("stores")
        self.products = self._read("products")
        self.daily = self._read("daily_operations")
        self.sales = self._read("sales")
        self.purchases = self._read("purchases")
        self.wastage = self._read("wastage")
        self.returns = self._read("returns")
        self.cycle_counts = self._read("cycle_counts")
        manifest_path = self.sample_dir / "manifest.json"
        self.manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
        self.store_by_id = {row["store_id"]: row for row in self.stores}
        self.product_by_id = {row["product_id"]: row for row in self.products}
        self.product_by_name = {row["product_name"]: row for row in self.products}
        self.last_date = max(date.fromisoformat(row["date"]) for row in self.daily)
        self._by_product: dict[tuple[str, str], list[dict]] = defaultdict(list)
        for row in self.daily:
            self._by_product[(row["store_id"], row["product_id"])].append(row)
        for rows in self._by_product.values():
            rows.sort(key=lambda item: item["date"])
        self.issues = self.detect_issues()

    def _read(self, name: str) -> list[dict]:
        if self._bigquery_client is not None:
            from backend.app.google_cloud import BIGQUERY_DATASET, PROJECT_ID
            table_id = f"{PROJECT_ID}.{BIGQUERY_DATASET}.{name}"
            try:
                rows = self._bigquery_client.query(f"SELECT * FROM `{table_id}`").result()
                return [{key: "" if value is None else str(value) for key, value in row.items()} for row in rows]
            except Exception as exc:
                raise RuntimeError(f"Could not load required BigQuery table {table_id}: {exc.__class__.__name__}") from exc
        path = self.sample_dir / f"{name}.csv"
        if not path.exists():
            raise FileNotFoundError(f"Missing {path}. Generate the sample dataset with `python3 -m data.generator.generate`.")
        with path.open(newline="", encoding="utf-8") as file:
            return list(csv.DictReader(file))

    def _rows(self, store_id: str, product_id: str) -> list[dict]:
        return self._by_product[(store_id, product_id)]

    def _issue_id(self, index: int) -> str:
        return f"DO-{2048 - index}"

    def detect_issues(self) -> list[dict]:
        return [self._tomato_wastage(), self._milk_expiry(), self._stock_variance(), self._spinach_returns(), self._prepared_meal_expiry()]

    def _tomato_wastage(self) -> dict:
        store_id, product = "BLR-04", self.product_by_name["Tomatoes"]
        rows = self._rows(store_id, product["product_id"])
        recent, previous = rows[-7:], rows[-35:-7]
        waste = sum(number(row, "wasted_qty") for row in recent)
        baseline_waste = sum(number(row, "wasted_qty") for row in previous) / 4
        recent_purchases = sum(number(row, "received_qty") for row in recent)
        baseline_purchases = sum(number(row, "received_qty") for row in previous) / 4
        recent_sales = sum(number(row, "sold_qty") for row in recent)
        baseline_sales = sum(number(row, "sold_qty") for row in previous) / 4
        cover = number(rows[-1], "closing_qty") / max(recent_sales / 7, 1)
        purchase_delta = percent_change(recent_purchases, baseline_purchases)
        sales_delta = percent_change(recent_sales, baseline_sales)
        waste_multiple = waste / max(baseline_waste, 1)
        cause_score = min(96, round(60 + purchase_delta * 0.65))
        supplier_score = 34
        store = self.store_by_id[store_id]
        return {
            "id": self._issue_id(0), "title": f"Tomato wastage is {waste_multiple:.1f}× above baseline", "product": f"{product['product_name']} · 1 kg",
            "category": "Wastage", "store": store["name"], "store_code": store_id,
            "impact": round(waste * number(product, "unit_cost_inr")), "units": f"{int(waste)} kg wasted",
            "severity": "High" if waste_multiple >= 2.5 else "Medium", "status": "Investigating", "age": "18 min ago", "icon": "🍅", "color": "coral",
            "summary": "Wastage climbed while sales stayed near the four-week average. Stock cover is above the target.",
            "signal": f"{int(waste)} kg discarded in the last 7 days, versus a {rounded(baseline_waste)} kg weekly baseline.",
            "evidence": [
                {"label": "Purchase volume", "value": f"{purchase_delta:+.0f}%", "note": "vs. prior 4-week weekly average", "direction": "bad" if purchase_delta > 15 else "neutral"},
                {"label": "Sales volume", "value": f"{sales_delta:+.0f}%", "note": "vs. prior 4-week weekly average", "direction": "good" if abs(sales_delta) < 15 else "bad"},
                {"label": "Days of cover", "value": f"{cover:.1f} days", "note": "target is 2.5 days", "direction": "bad" if cover > 2.5 else "good"},
            ],
            "hypotheses": [
                {"name": "Over-ordering relative to demand", "score": cause_score, "detail": f"Purchases rose {purchase_delta:.0f}% while sales rose {sales_delta:.0f}%; closing stock is {cover:.1f} days of cover."},
                {"name": "Supplier quality issue", "score": supplier_score, "detail": "No matching return spike is present for this product in the generated return records."},
            ],
            "recommendation": "Reduce the next order by 20% and review the par level after the next delivery.",
            "verification": {"before": int(waste), "after": max(0, int(round(waste * 0.29))), "unit": "kg wasted", "period": "7 days", "source": "Synthetic follow-up comparison"},
            "evidence_refs": ["daily_operations.csv", "wastage.csv", "purchases.csv", "sales.csv"],
        }

    def _milk_expiry(self) -> dict:
        store_id, product = "BLR-02", self.product_by_name["Farm fresh milk 500 ml"]
        rows = self._rows(store_id, product["product_id"])
        current = rows[-1]
        at_risk = number(current, "units_at_risk_48h")
        recent_sales = sum(number(row, "sold_qty") for row in rows[-7:]) / 7
        cover = number(current, "closing_qty") / max(recent_sales, 1)
        value = round(at_risk * number(product, "unit_cost_inr"))
        return {
            "id": self._issue_id(1), "title": "Expiry exposure building in dairy", "product": product["product_name"],
            "category": "Expiry risk", "store": self.store_by_id[store_id]["name"], "store_code": store_id,
            "impact": value, "units": f"{int(at_risk)} units at risk", "severity": "High", "status": "Action needed",
            "age": "42 min ago", "icon": "🥛", "color": "blue",
            "summary": f"{int(at_risk)} units enter their final 48 hours with current sell-through too low to clear stock.",
            "signal": f"{money(value)} at cost is likely to expire in the next 48 hours.",
            "evidence": [
                {"label": "Near-expiry units", "value": str(int(at_risk)), "note": "within 48 hours", "direction": "bad"},
                {"label": "Daily sell-through", "value": f"{recent_sales:.0f} units", "note": "7-day average", "direction": "neutral"},
                {"label": "Stock cover", "value": f"{cover:.1f} days", "note": "expiry window is 2 days", "direction": "bad" if cover > 2 else "good"},
            ],
            "hypotheses": [
                {"name": "Order quantity exceeded sell-through", "score": 81, "detail": "Current inventory cover exceeds the two-day expiry window."},
                {"name": "Delivery arrived with short shelf life", "score": 52, "detail": "The prototype tracks expiry exposure, but not shelf life at receipt yet."},
            ],
            "recommendation": "Prioritize first-expiry stock and lower the next replenishment quantity for two cycles.",
            "verification": {"before": int(at_risk), "after": int(round(at_risk * 0.30)), "unit": "units at risk", "period": "7 days", "source": "Synthetic follow-up comparison"},
            "evidence_refs": ["daily_operations.csv", "purchases.csv", "products.csv"],
        }

    def _stock_variance(self) -> dict:
        store_id, product = "BLR-01", self.product_by_name["Aashirvaad atta 5 kg"]
        counts = [row for row in self.cycle_counts if row["store_id"] == store_id and row["product_id"] == product["product_id"]]
        count = max(counts, key=lambda row: row["date"])
        variance = abs(number(count, "variance_qty"))
        value = round(variance * number(product, "unit_cost_inr"))
        return {
            "id": self._issue_id(2), "title": "Stock count differs from expected", "product": product["product_name"],
            "category": "Stock variance", "store": self.store_by_id[store_id]["name"], "store_code": store_id,
            "impact": value, "units": f"{int(variance)} units variance", "severity": "Medium", "status": "Review",
            "age": "1 hr ago", "icon": "🌾", "color": "gold",
            "summary": "The latest cycle count differs from the inventory ledger; reconcile movements before adjusting the record.",
            "signal": f"{int(variance)} units differ between expected and counted stock on {count['date']}.",
            "evidence": [
                {"label": "Expected on hand", "value": str(int(number(count, "expected_qty"))), "note": "inventory ledger", "direction": "neutral"},
                {"label": "Counted on hand", "value": str(int(number(count, "counted_qty"))), "note": f"cycle count · {count['date']}", "direction": "bad"},
                {"label": "Variance", "value": f"{number(count, 'variance_qty'):+.0f} units", "note": "counted minus expected", "direction": "bad"},
            ],
            "hypotheses": [
                {"name": "Unrecorded stock movement", "score": 73, "detail": "A physical count variance remains after the recorded stock movements."},
                {"name": "Receiving count error", "score": 41, "detail": "Review the linked purchase receipts before changing the ledger quantity."},
            ],
            "recommendation": "Recount the aisle and reconcile recent receiving and pick events before adjusting stock.",
            "verification": {"before": int(variance), "after": max(0, int(round(variance * 0.17))), "unit": "units variance", "period": "7 days", "source": "Synthetic follow-up comparison"},
            "evidence_refs": ["cycle_counts.csv", "purchases.csv", "daily_operations.csv"],
        }

    def _spinach_returns(self) -> dict:
        store_id, product = "BLR-04", self.product_by_name["Baby spinach"]
        start = self.last_date - timedelta(days=6)
        current_returns = [row for row in self.returns if row["store_id"] == store_id and row["product_id"] == product["product_id"] and date.fromisoformat(row["date"]) >= start]
        previous_start = start - timedelta(days=28)
        previous_returns = [row for row in self.returns if row["store_id"] == store_id and row["product_id"] == product["product_id"] and previous_start <= date.fromisoformat(row["date"]) < start]
        sales_rows = self._rows(store_id, product["product_id"])
        recent_sales = sum(number(row, "sold_qty") for row in sales_rows[-7:])
        previous_sales = sum(number(row, "sold_qty") for row in sales_rows[-35:-7])
        recent_rate = sum(number(row, "quantity") for row in current_returns) / max(recent_sales, 1) * 100
        baseline_rate = sum(number(row, "quantity") for row in previous_returns) / max(previous_sales, 1) * 100
        batch_counts: dict[str, int] = defaultdict(int)
        for row in current_returns:
            batch_counts[row["batch_id"]] += int(number(row, "quantity"))
        top_batch, top_count = max(batch_counts.items(), key=lambda item: item[1])
        batch_share = top_count / max(sum(number(row, "quantity") for row in current_returns), 1) * 100
        refund = round(sum(number(row, "refund_inr") for row in current_returns))
        rate_ratio = recent_rate / max(baseline_rate, 0.1)
        wilt_count = sum(int(number(row, "quantity")) for row in current_returns if row["reason"] == "wilting")
        return {
            "id": self._issue_id(3), "title": "Return rate spiked for packaged greens", "product": f"{product['product_name']} · 100 g",
            "category": "Returns", "store": self.store_by_id[store_id]["name"], "store_code": store_id,
            "impact": refund, "units": f"{recent_rate:.1f}% return rate", "severity": "Medium", "status": "Investigating",
            "age": "2 hrs ago", "icon": "🥬", "color": "green",
            "summary": "Recent returns cite wilting and damaged seals, concentrated in one synthetic supplier lot.",
            "signal": f"Return rate rose from {baseline_rate:.1f}% to {recent_rate:.1f}% across the latest 7 days.",
            "evidence": [
                {"label": "Return rate", "value": f"{recent_rate:.1f}%", "note": f"baseline is {baseline_rate:.1f}%", "direction": "bad"},
                {"label": "Batch share", "value": f"{batch_share:.0f}%", "note": "of returns share one lot", "direction": "bad"},
                {"label": "Top reason", "value": "Wilting", "note": f"{wilt_count} of {int(sum(number(row, 'quantity') for row in current_returns))} returns", "direction": "neutral"},
            ],
            "hypotheses": [
                {"name": "Supplier batch quality", "score": min(95, round(55 + rate_ratio * 7)), "detail": f"{batch_share:.0f}% of the recent returns trace to lot {top_batch}."},
                {"name": "Handling or cold-chain issue", "score": 49, "detail": "Review receiving and cold-storage checks for the affected period."},
            ],
            "recommendation": "Hold the affected lot for a quality check and inspect the next delivery on receipt.",
            "verification": {"before": rounded(recent_rate), "after": rounded(baseline_rate * 1.4), "unit": "% return rate", "period": "7 days", "source": "Synthetic follow-up comparison"},
            "evidence_refs": ["returns.csv", "sales.csv", "purchases.csv"],
        }

    def _prepared_meal_expiry(self) -> dict:
        store_id, product = "BLR-03", self.product_by_name["Paneer tikka wrap"]
        row = self._rows(store_id, product["product_id"])[-1]
        at_risk = number(row, "units_at_risk_48h")
        recent_sales = sum(number(item, "sold_qty") for item in self._rows(store_id, product["product_id"])[-14:]) / 14
        impact = round(at_risk * number(product, "unit_cost_inr"))
        return {
            "id": self._issue_id(4), "title": "Prepared meals nearing expiry", "product": f"{product['product_name']} · 1 pc",
            "category": "Expiry risk", "store": self.store_by_id[store_id]["name"], "store_code": store_id,
            "impact": impact, "units": f"{int(at_risk)} units at risk", "severity": "Low", "status": "Monitoring",
            "age": "3 hrs ago", "icon": "🥡", "color": "purple",
            "summary": "Recent sell-through may not clear the prepared-meal inventory before its expiry window.",
            "signal": f"{int(at_risk)} units reach expiry in 48 hours; recent daily sell-through averages {recent_sales:.0f} units.",
            "evidence": [
                {"label": "Units expiring soon", "value": str(int(at_risk)), "note": "current stock", "direction": "bad"},
                {"label": "Daily sell-through", "value": f"{recent_sales:.0f} units", "note": "14-day average", "direction": "neutral"},
                {"label": "Potential excess", "value": f"{max(0, int(at_risk - recent_sales * 2))} units", "note": "after expected sales", "direction": "bad"},
            ],
            "hypotheses": [
                {"name": "Prep forecast too high", "score": 69, "detail": "Current at-risk stock is above expected sell-through within the expiry window."},
                {"name": "Demand shifted by weekday", "score": 45, "detail": "Compare the next week's weekday demand before changing the prep baseline."},
            ],
            "recommendation": "Reduce weekday prep by 10% and review evening sell-through after one week.",
            "verification": {"before": int(at_risk), "after": int(round(at_risk * 0.39)), "unit": "units at risk", "period": "7 days", "source": "Synthetic follow-up comparison"},
            "evidence_refs": ["daily_operations.csv", "sales.csv", "products.csv"],
        }

    def filtered_issues(self, category: str | None = None, store: str | None = None, query: str | None = None) -> list[dict]:
        result = self.issues
        if category and category.lower() != "all":
            result = [row for row in result if row["category"].lower() == category.lower()]
        if store:
            store_id = next((key for key, value in self.store_by_id.items() if value["name"] == store or key == store), store)
            result = [row for row in result if row["store_code"] == store_id]
        if query:
            term = query.lower()
            result = [row for row in result if term in " ".join(str(row.get(key, "")) for key in ("id", "title", "product", "store", "category")).lower()]
        return result

    def overview(self, store: str | None = None) -> dict:
        issues = self.filtered_issues(store=store)
        issue_by_store: dict[str, int] = defaultdict(int)
        for issue in self.issues:
            issue_by_store[issue["store_code"]] += issue["impact"]
        store_rows = []
        for store_row in self.stores:
            if store and store not in {store_row["name"], store_row["store_id"]}:
                continue
            sid = store_row["store_id"]
            waste_cost = sum(number(row, "wasted_qty") * number(row, "unit_cost_inr") for row in self.daily if row["store_id"] == sid)
            sales_value = sum(number(row, "net_sales_inr") for row in self.sales if row["store_id"] == sid)
            recent_rows = [row for row in self.daily if row["store_id"] == sid and date.fromisoformat(row["date"]) >= self.last_date - timedelta(days=6)]
            total_qty = sum(number(row, "sold_qty") for row in recent_rows)
            total_waste = sum(number(row, "wasted_qty") for row in recent_rows)
            waste_rate = total_waste / max(total_qty + total_waste, 1) * 100
            store_rows.append({"name": store_row["name"], "code": sid, "loss": issue_by_store[sid] or round(waste_cost),
                               "waste": rounded(waste_rate), "change": round((waste_rate - 2.5) * 0.45, 1)})
        selected_store_id = next((key for key, value in self.store_by_id.items() if store in {value["name"], key}), None) if store else None
        period = [self.last_date - timedelta(days=offset) for offset in reversed(range(7))]
        weekly_loss = [{"day": day.strftime("%a"), "value": rounded(sum(number(row, "wasted_qty") * number(row, "unit_cost_inr") for row in self.daily if row["date"] == day.isoformat() and (not selected_store_id or row["store_id"] == selected_store_id)) / 1000, 1)} for day in period]
        category_totals = []
        for category in ("Wastage", "Expiry risk", "Stock variance", "Returns"):
            category_totals.append({"name": category, "value": sum(issue["impact"] for issue in issues if issue["category"] == category)})
        at_risk_rows = [row for row in self.daily if row["date"] == self.last_date.isoformat() and (not selected_store_id or row["store_id"] == selected_store_id)]
        return {
            "as_of": self.last_date.isoformat(), "is_demo": True, "currency": "INR",
            "metrics": {"loss_at_risk": sum(issue["impact"] for issue in issues),
                        "active_cases": len([issue for issue in issues if issue["status"] != "Verified"]),
                        "waste_rate": rounded(sum(row["waste"] for row in store_rows) / max(len(store_rows), 1)),
                        "urgent_cases": len([issue for issue in issues if issue["severity"] == "High"]),
                        "expiry_at_risk": round(sum(number(row, "units_at_risk_48h") * number(row, "unit_cost_inr") for row in at_risk_rows)),
                        "expiry_units": int(sum(number(row, "units_at_risk_48h") for row in at_risk_rows))},
            "weekly_loss": weekly_loss, "stores": store_rows, "category_totals": category_totals,
        }

    def summary(self) -> dict:
        tables = {"stores": self.stores, "products": self.products, "daily_operations": self.daily,
                  "sales": self.sales, "purchases": self.purchases, "wastage": self.wastage,
                  "returns": self.returns, "cycle_counts": self.cycle_counts}
        return {"is_demo": True, "source": self.source, "seed": self.manifest.get("seed"), "date_start": min(row["date"] for row in self.daily),
                "date_end": self.last_date.isoformat(), "table_counts": {name: len(rows) for name, rows in tables.items()},
                "known_scenarios": ["produce over-ordering and wastage", "near-expiry dairy stock", "cycle-count variance",
                                    "supplier-lot return spike", "prepared-meal expiry exposure"]}


def money(value: float) -> str:
    return f"₹{value:,.0f}"
