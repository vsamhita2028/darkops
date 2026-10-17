# Synthetic demo data

The generator in `data/generator/generate.py` writes repeatable CSV tables alongside this note. The committed snapshot uses seed `17017`, covers 2026-08-23 through 2026-10-17, and contains four Bengaluru stores, 40 SKUs and 56 daily periods. `manifest.json` records the generation parameters and row counts.

Tables include `stores`, `products`, `daily_operations`, `sales`, `purchases`, `wastage`, `returns`, and `cycle_counts`. The generated scenarios include:

- fresh produce over-ordering and wastage
- dairy expiry exposure
- cycle-count stock variance
- supplier batch returns
- ready-to-eat expiry risk

The API derives issue metrics from these records. Follow-up periods remain illustrative. No real store, supplier, customer, or transaction data is included.
