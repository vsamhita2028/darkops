"""Create a deterministic, fictional dark-store operations dataset."""

from __future__ import annotations

import argparse
import csv
import json
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "data" / "samples"
SEED = 17017

STORES = [
    {"store_id": "BLR-01", "name": "HSR Layout", "city": "Bengaluru", "area": "HSR Layout", "store_type": "dark_store"},
    {"store_id": "BLR-02", "name": "Koramangala", "city": "Bengaluru", "area": "Koramangala", "store_type": "dark_store"},
    {"store_id": "BLR-03", "name": "Whitefield", "city": "Bengaluru", "area": "Whitefield", "store_type": "dark_store"},
    {"store_id": "BLR-04", "name": "Indiranagar", "city": "Bengaluru", "area": "Indiranagar", "store_type": "dark_store"},
]

# Eight products in each category gives the 40-SKU starter catalog described in the plan.
PRODUCT_SEEDS = [
    ("produce", [
        ("Tomatoes", "kg", 40, 78, 6, 22), ("Baby spinach", "pack", 32, 55, 5, 18),
        ("Banana", "kg", 38, 62, 7, 16), ("Potato", "kg", 28, 44, 30, 20),
        ("Onion", "kg", 34, 52, 25, 18), ("Coriander", "bunch", 12, 22, 4, 13),
        ("Capsicum", "kg", 56, 85, 8, 10), ("Carrot", "kg", 42, 65, 18, 12),
    ]),
    ("dairy", [
        ("Farm fresh milk 500 ml", "unit", 28, 34, 7, 42), ("Curd 400 g", "unit", 31, 42, 10, 25),
        ("Paneer 200 g", "unit", 74, 99, 8, 16), ("Butter 100 g", "unit", 48, 62, 40, 11),
        ("Cheese slices", "pack", 82, 110, 35, 9), ("Greek yogurt", "unit", 56, 75, 12, 8),
        ("Buttermilk", "unit", 18, 25, 5, 15), ("Fresh cream", "unit", 48, 66, 12, 7),
    ]),
    ("ready_meals", [
        ("Paneer tikka wrap", "unit", 70, 115, 2, 12), ("Veg biryani bowl", "unit", 82, 135, 2, 15),
        ("Chicken sandwich", "unit", 76, 129, 2, 13), ("Idli sambar pack", "unit", 42, 72, 2, 17),
        ("Dal rice bowl", "unit", 68, 110, 2, 11), ("Poha breakfast bowl", "unit", 38, 65, 2, 10),
        ("Pasta salad", "unit", 74, 125, 3, 8), ("Egg curry meal", "unit", 78, 129, 2, 9),
    ]),
    ("pantry", [
        ("Aashirvaad atta 5 kg", "bag", 265, 329, 180, 6), ("Toor dal 1 kg", "pack", 112, 149, 365, 6),
        ("Basmati rice 1 kg", "pack", 94, 129, 365, 7), ("Cooking oil 1 L", "bottle", 128, 165, 300, 8),
        ("Sugar 1 kg", "pack", 44, 58, 365, 7), ("Salt 1 kg", "pack", 18, 25, 730, 5),
        ("Oats 500 g", "pack", 78, 105, 240, 5), ("Peanut butter", "jar", 142, 189, 240, 4),
    ]),
    ("beverages", [
        ("Orange juice 1 L", "bottle", 72, 99, 90, 8), ("Cola 750 ml", "bottle", 32, 45, 180, 17),
        ("Packaged water 1 L", "bottle", 12, 20, 365, 24), ("Cold coffee", "bottle", 48, 69, 120, 9),
        ("Coconut water", "unit", 34, 49, 45, 8), ("Green tea 25 bags", "box", 118, 159, 540, 3),
        ("Filter coffee 200 g", "pack", 96, 129, 240, 5), ("Mango drink 600 ml", "bottle", 28, 39, 180, 11),
    ]),
]


def catalog() -> list[dict]:
    products = []
    for category, items in PRODUCT_SEEDS:
        prefix = {"produce": "PRD", "dairy": "DRY", "ready_meals": "RTE", "pantry": "PAN", "beverages": "BEV"}[category]
        for index, (name, unit, cost, retail, shelf_life, demand) in enumerate(items, 1):
            products.append({
                "product_id": f"{prefix}-{index:02d}", "product_name": name, "category": category,
                "unit": unit, "unit_cost_inr": cost, "retail_price_inr": retail,
                "shelf_life_days": shelf_life, "baseline_daily_demand": demand,
                "supplier_id": f"SUP-{(index % 6) + 1:02d}",
            })
    return products


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def distribute(total: int, weights: list[int]) -> list[int]:
    weight_sum = sum(weights) or 1
    output = [total * weight // weight_sum for weight in weights]
    for index in range(total - sum(output)):
        output[index % len(output)] += 1
    return output


def generate(output_dir: Path = DEFAULT_OUTPUT, seed: int = SEED, as_of: date | None = None) -> dict[str, int]:
    rng = random.Random(seed)
    as_of = as_of or date.today()
    dates = [as_of - timedelta(days=offset) for offset in reversed(range(56))]
    products = catalog()
    store_factors = {"BLR-01": 0.92, "BLR-02": 1.10, "BLR-03": 0.86, "BLR-04": 1.06}
    daily_rows: list[dict] = []
    return_rows: list[dict] = []
    count_rows: list[dict] = []
    purchase_rows: list[dict] = []
    waste_rows: list[dict] = []
    sale_rows: list[dict] = []

    tomato = next(p for p in products if p["product_name"] == "Tomatoes")
    milk = next(p for p in products if p["product_name"] == "Farm fresh milk 500 ml")
    atta = next(p for p in products if p["product_name"] == "Aashirvaad atta 5 kg")
    spinach = next(p for p in products if p["product_name"] == "Baby spinach")
    wrap = next(p for p in products if p["product_name"] == "Paneer tikka wrap")

    for store in STORES:
        sid = store["store_id"]
        for product in products:
            pid = product["product_id"]
            base = product["baseline_daily_demand"] * store_factors[sid]
            factor = {"Monday": 1.0, "Tuesday": 1.0, "Wednesday": 1.0, "Thursday": 1.04,
                      "Friday": 1.10, "Saturday": 1.18, "Sunday": 1.12}
            stock = max(1, round(base * 2.2))
            rows_for_product = []
            for day in dates:
                weekday_factor = factor[day.strftime("%A")]
                sold = max(0, round(base * weekday_factor * rng.uniform(0.78, 1.22)))
                received = 0
                target_cover = 2.6 if product["category"] in {"produce", "dairy", "ready_meals"} else 4.2
                if stock < base * target_cover:
                    received = max(1, round(base * target_cover - stock + base * rng.uniform(0.15, 0.7)))
                waste = 0
                if product["category"] in {"produce", "dairy", "ready_meals"} and stock + received > sold:
                    waste = min(max(0, stock + received - sold), 1 if product["category"] == "produce" else 0)
                    if product["category"] == "dairy" and rng.random() < 0.08:
                        waste = 1
                    if product["category"] == "ready_meals" and rng.random() < 0.11:
                        waste = 1
                opening = stock
                closing = max(0, opening + received - sold - waste)
                risk_units = 0
                rows_for_product.append({
                    "date": day.isoformat(), "store_id": sid, "product_id": pid,
                    "opening_qty": opening, "received_qty": received, "sold_qty": sold,
                    "wasted_qty": waste, "closing_qty": closing, "units_at_risk_48h": risk_units,
                    "unit_cost_inr": product["unit_cost_inr"],
                })
                if sold:
                    sale_rows.append({"date": day.isoformat(), "store_id": sid, "product_id": pid,
                                      "quantity": sold, "net_sales_inr": round(sold * product["retail_price_inr"], 2)})
                if received:
                    purchase_id = f"PO-{sid[-2:]}-{pid}-{day.strftime('%y%m%d')}"
                    batch_id = f"LOT-{pid}-{day.strftime('%y%m%d')}"
                    expiry = day + timedelta(days=product["shelf_life_days"])
                    purchase_rows.append({"purchase_id": purchase_id, "date": day.isoformat(), "store_id": sid,
                                          "product_id": pid, "supplier_id": product["supplier_id"], "batch_id": batch_id,
                                          "quantity": received, "unit_cost_inr": product["unit_cost_inr"],
                                          "expiry_date": expiry.isoformat()})
                if waste:
                    waste_rows.append({"waste_id": f"W-{sid[-2:]}-{pid}-{day.strftime('%y%m%d')}", "date": day.isoformat(),
                                       "store_id": sid, "product_id": pid, "quantity": waste,
                                       "reason": rng.choice(["expired", "damaged", "quality"]),
                                       "unit_cost_inr": product["unit_cost_inr"]})
                stock = closing

            # Seed a detectable tomato over-ordering pattern at Indiranagar.
            if sid == "BLR-04" and pid == tomato["product_id"]:
                previous_weekly_purchase = sum(row["received_qty"] for row in rows_for_product[-35:-7]) / 4
                recent_purchase_total = round(previous_weekly_purchase * 1.42)
                purchases = distribute(recent_purchase_total, [rng.randint(8, 14) for _ in range(7)])
                baseline_weekly_sales = sum(row["sold_qty"] for row in rows_for_product[-35:-7]) / 4
                recent_sales_total = round(baseline_weekly_sales * 1.06)
                sales = distribute(recent_sales_total, [rng.randint(8, 14) for _ in range(7)])
                wastes = distribute(38, [rng.randint(1, 8) for _ in range(7)])
                previous_closing = rows_for_product[-8]["closing_qty"]
                for index, row in enumerate(rows_for_product[-7:]):
                    row["opening_qty"] = previous_closing
                    row["received_qty"] = purchases[index]
                    row["sold_qty"] = sales[index]
                    row["wasted_qty"] = wastes[index]
                    row["closing_qty"] = max(0, row["opening_qty"] + row["received_qty"] - row["sold_qty"] - row["wasted_qty"])
                    previous_closing = row["closing_qty"]
                # Keep event tables consistent with the revised seven-day tomato rows.
                sale_rows = [row for row in sale_rows if not (row["store_id"] == sid and row["product_id"] == pid and row["date"] >= dates[-7].isoformat())]
                purchase_rows = [row for row in purchase_rows if not (row["store_id"] == sid and row["product_id"] == pid and row["date"] >= dates[-7].isoformat())]
                waste_rows = [row for row in waste_rows if not (row["store_id"] == sid and row["product_id"] == pid and row["date"] >= dates[-7].isoformat())]
                for row in rows_for_product[-7:]:
                    day = date.fromisoformat(row["date"])
                    if row["sold_qty"]:
                        sale_rows.append({"date": row["date"], "store_id": sid, "product_id": pid, "quantity": row["sold_qty"],
                                          "net_sales_inr": round(row["sold_qty"] * tomato["retail_price_inr"], 2)})
                    purchase_rows.append({"purchase_id": f"PO-{sid[-2:]}-{pid}-{day.strftime('%y%m%d')}", "date": row["date"],
                                          "store_id": sid, "product_id": pid, "supplier_id": tomato["supplier_id"],
                                          "batch_id": f"LOT-{pid}-{day.strftime('%y%m%d')}", "quantity": row["received_qty"],
                                          "unit_cost_inr": tomato["unit_cost_inr"], "expiry_date": (day + timedelta(days=6)).isoformat()})
                    waste_rows.append({"waste_id": f"W-{sid[-2:]}-{pid}-{day.strftime('%y%m%d')}", "date": row["date"],
                                       "store_id": sid, "product_id": pid, "quantity": row["wasted_qty"],
                                       "reason": "expired", "unit_cost_inr": tomato["unit_cost_inr"]})

            # Expiry exposure is an inventory signal, linked to latest on-hand stock.
            if sid == "BLR-02" and pid == milk["product_id"]:
                rows_for_product[-1]["units_at_risk_48h"] = 64
            if sid == "BLR-03" and pid == wrap["product_id"]:
                rows_for_product[-1]["units_at_risk_48h"] = 23

            daily_rows.extend(rows_for_product)

            # Weekly cycle counts with routine small count noise; one seeded 12-unit variance.
            for offset in range(0, 56, 7):
                day_index = min(offset + 6, 55)
                row = rows_for_product[day_index]
                expected = row["closing_qty"]
                counted = max(0, expected + rng.choice([-1, 0, 0, 0, 1]))
                if sid == "BLR-01" and pid == atta["product_id"] and day_index == 55:
                    counted = max(0, expected - 12)
                count_rows.append({"count_id": f"CC-{sid[-2:]}-{pid}-{row['date']}", "date": row["date"],
                                   "store_id": sid, "product_id": pid, "expected_qty": expected,
                                   "counted_qty": counted, "variance_qty": counted - expected})

    # Returns are event rows. The last week of Indiranagar spinach is deliberately concentrated in one lot.
    recent_start = dates[-7]
    for store in STORES:
        for product in products:
            for row in (record for record in daily_rows if record["store_id"] == store["store_id"] and record["product_id"] == product["product_id"]):
                if store["store_id"] == "BLR-04" and product["product_id"] == spinach["product_id"] and row["date"] >= (as_of - timedelta(days=34)).isoformat():
                    continue
                if rng.random() < 0.012:
                    quantity = 1
                    return_rows.append({"return_id": f"RET-{len(return_rows)+1:06d}", "date": row["date"],
                                        "store_id": store["store_id"], "product_id": product["product_id"],
                                        "quantity": quantity, "reason": rng.choice(["damaged", "quality", "wrong_item"]),
                                        "refund_inr": product["retail_price_inr"], "batch_id": f"LOT-{product['product_id']}-NORMAL"})
    weights = [rng.randint(8, 14) for _ in range(7)]
    recent_returns = distribute(11, weights)
    for index, day in enumerate(dates[-7:]):
        quantity = recent_returns[index]
        reasons = ["wilting", "wilting", "wilting", "wilting", "wilting", "damaged_seal", "damaged_seal", "quality", "quality", "damaged", "wilting"]
        for unit_index in range(quantity):
            reason = reasons[(index + unit_index) % len(reasons)]
            return_rows.append({"return_id": f"RET-{len(return_rows)+1:06d}", "date": day.isoformat(),
                                "store_id": "BLR-04", "product_id": spinach["product_id"], "quantity": 1,
                                "reason": reason, "refund_inr": spinach["retail_price_inr"], "batch_id": "LOT-SPINACH-884"})

    # Establish a 2% reference return rate for spinach in the four weeks before the spike.
    spinach_history_days = [day for day in dates[-35:-7]]
    for index in range(11):
        day = spinach_history_days[(index * 2 + 1) % len(spinach_history_days)]
        return_rows.append({"return_id": f"RET-{len(return_rows)+1:06d}", "date": day.isoformat(),
                            "store_id": "BLR-04", "product_id": spinach["product_id"], "quantity": 1,
                            "reason": "wilting", "refund_inr": spinach["retail_price_inr"], "batch_id": "LOT-SPINACH-HISTORY"})

    output_dir.mkdir(parents=True, exist_ok=True)
    write_csv(output_dir / "stores.csv", STORES, list(STORES[0]))
    write_csv(output_dir / "products.csv", products, list(products[0]))
    write_csv(output_dir / "daily_operations.csv", daily_rows, list(daily_rows[0]))
    write_csv(output_dir / "sales.csv", sale_rows, list(sale_rows[0]))
    write_csv(output_dir / "purchases.csv", purchase_rows, list(purchase_rows[0]))
    write_csv(output_dir / "wastage.csv", waste_rows, list(waste_rows[0]))
    write_csv(output_dir / "returns.csv", return_rows, list(return_rows[0]))
    write_csv(output_dir / "cycle_counts.csv", count_rows, list(count_rows[0]))
    counts = {"stores": len(STORES), "products": len(products), "days": len(dates), "daily_operations": len(daily_rows),
            "sales": len(sale_rows), "purchases": len(purchase_rows), "wastage": len(waste_rows),
            "returns": len(return_rows), "cycle_counts": len(count_rows)}
    (output_dir / "manifest.json").write_text(json.dumps({"seed": seed, "date_start": dates[0].isoformat(),
                                      "date_end": dates[-1].isoformat(), "row_counts": counts,
                                      "synthetic": True}, indent=2) + "\n", encoding="utf-8")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Directory for generated CSV tables")
    parser.add_argument("--seed", type=int, default=SEED, help="Random seed for repeatable records")
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today(), help="Final dataset date (YYYY-MM-DD)")
    args = parser.parse_args()
    counts = generate(args.output, args.seed, args.as_of)
    print(f"Generated synthetic DarkOps dataset through {args.as_of.isoformat()} at {args.output}")
    for table, count in counts.items():
        print(f"  {table}: {count:,}")


if __name__ == "__main__":
    main()
