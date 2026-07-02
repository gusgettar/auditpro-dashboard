#!/usr/bin/env python3
"""
export_data.py - Argentine restaurant POS data exporter.
Reads ~/Downloads/db.mdb via mdb-export and writes pre-computed JSON files
to ~/proyectos/restaurant-audit-dashboard/backend/data/

MDB date format: MM/DD/YY HH:MM:SS (e.g. "12/09/25 16:35:14" = 2025-12-09)
Year is ALWAYS parsed as 2000 + YY.
"""

import csv
import io
import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MDB_PATH   = str(Path.home() / "Downloads" / "db.mdb")
MDB_EXPORT = "/opt/homebrew/bin/mdb-export"
OUT_DIR    = Path.home() / "proyectos" / "restaurant-audit-dashboard" / "backend" / "data"

OUT_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def export_table(table_name):
    """Run mdb-export for one table; return list of row dicts."""
    print(f"  Exporting {table_name} ...", end=" ", flush=True)
    result = subprocess.run(
        [MDB_EXPORT, MDB_PATH, table_name],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0 or not result.stdout.strip():
        print(f"EMPTY/ERROR (stderr: {result.stderr.strip()[:100]})")
        return []
    reader = csv.DictReader(io.StringIO(result.stdout))
    rows = list(reader)
    print(f"{len(rows)} rows")
    return rows


def parse_date(raw):
    """
    Parse MDB date string MM/DD/YY HH:MM:SS -> ISO 8601 string.
    Year is ALWAYS interpreted as 2000 + YY.
    Returns None for empty or unparseable values.
    """
    if not raw:
        return None
    s = raw.strip().strip('"')
    if not s:
        return None
    for fmt in ("%m/%d/%y %H:%M:%S", "%m/%d/%y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            dt = datetime.strptime(s, fmt)
            # strptime %y: 00-68 -> 2000-2068, 69-99 -> 1969-1999
            # This MDB always stores post-2000 years; fix the 1969-1999 range
            if dt.year < 2000:
                dt = dt.replace(year=dt.year + 100)
            return dt.strftime("%Y-%m-%dT%H:%M:%S")
        except ValueError:
            continue
    return None


def parse_date_only(raw):
    iso = parse_date(raw)
    return iso[:10] if iso else None


def safe_float(v):
    if v is None or str(v).strip() in ("", "NULL"):
        return 0.0
    try:
        return float(str(v).replace(",", "."))
    except (ValueError, TypeError):
        return 0.0


def safe_int(v):
    try:
        return int(float(str(v)))
    except (ValueError, TypeError):
        return 0


def clean_str(v):
    if v is None:
        return ""
    return str(v).strip().strip('"')


def minutes_between(start_iso, end_iso):
    """Return minutes between two ISO datetime strings, or None."""
    if not start_iso or not end_iso:
        return None
    try:
        fmt = "%Y-%m-%dT%H:%M:%S"
        s = datetime.strptime(start_iso, fmt)
        e = datetime.strptime(end_iso, fmt)
        return round((e - s).total_seconds() / 60.0, 2)
    except Exception:
        return None


def write_json(filename, data):
    """Write data as JSON to OUT_DIR/filename; print size."""
    path = OUT_DIR / filename
    content = json.dumps(data, ensure_ascii=False, indent=2, default=str)
    path.write_text(content, encoding="utf-8")
    size = path.stat().st_size
    label = f"{len(data)} rows" if isinstance(data, list) else "object"
    print(f"  -> {filename:<45} {size:>10,} bytes  ({label})")
    return size


def agg_by_user(rows, user_key="user_name", amount_key="total"):
    """Aggregate rows by user, return sorted list of {user, count, amount}."""
    agg = defaultdict(lambda: {"count": 0, "amount": 0.0})
    for r in rows:
        u = clean_str(r.get(user_key)) or "UNKNOWN"
        agg[u]["count"]  += 1
        agg[u]["amount"] += abs(safe_float(r.get(amount_key, 0)))
    return sorted(
        [{"user": u, "count": d["count"], "amount": round(d["amount"], 2)}
         for u, d in agg.items()],
        key=lambda x: x["count"],
        reverse=True,
    )


def top_observations(rows, obs_key="observation", n=15):
    cnt = defaultdict(int)
    for r in rows:
        obs = clean_str(r.get(obs_key)) or "(empty)"
        cnt[obs] += 1
    return sorted(
        [{"obs": k, "count": v} for k, v in cnt.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:n]


# ---------------------------------------------------------------------------
# 1. Load all tables
# ---------------------------------------------------------------------------
print("\n=== STEP 1: LOADING TABLES ===")

# Core business
orders_raw         = export_table("Order")
order_items_raw    = export_table("OrderItem")
order_payments_raw = export_table("OrderPayment")
invoices_raw       = export_table("Invoice")
purchases_raw      = export_table("Purchase")
withdraws_raw      = export_table("Withdraw")
customers_raw      = export_table("Customer")
products_raw       = export_table("Product")
party_raw          = export_table("Party")
rubro_raw          = export_table("Rubro")
supplier_raw       = export_table("Supplier")
cash_drawer_raw    = export_table("CashDrawerItem")
db_version_raw     = export_table("DbVersion")

# Audit tables
removed_items_raw = export_table("OrderRestaurantRemovedItem")
rest_disc_raw     = export_table("OrderRestaurantChangedDiscount")
del_disc_raw      = export_table("OrderDeliveryChangedDiscount")
rest_price_raw    = export_table("OrderRestaurantChangedItemPrice")
del_price_raw     = export_table("OrderDeliveryChangedItemPrice")
rest_qty_raw      = export_table("OrderRestaurantDecreasedItemQuantity")
audit_pay_raw     = export_table("AuditPaymentType")
inactivation_raw  = export_table("OrderInactivation")

# ---------------------------------------------------------------------------
# 2. Build lookup maps
# ---------------------------------------------------------------------------
print("\n=== STEP 2: BUILDING LOOKUP MAPS ===")

party_map = {r["party_id"]: clean_str(r.get("name")) for r in party_raw}

product_map = {
    r["product_id"]: {
        "name":     clean_str(r.get("name")),
        "rubro_id": r.get("rubro_id", ""),
        "code":     clean_str(r.get("code")),
        "price":    safe_float(r.get("price")),
        "cost":     safe_float(r.get("cost")),
        "inactive": safe_int(r.get("inactive")),
    }
    for r in products_raw
}

rubro_map = {r["rubro_id"]: clean_str(r.get("name")) for r in rubro_raw}

# order_id -> full row
order_map = {r["order_id"]: r for r in orders_raw}

print(f"  party_map:   {len(party_map)} entries")
print(f"  product_map: {len(product_map)} entries")
print(f"  rubro_map:   {len(rubro_map)} entries")
print(f"  order_map:   {len(order_map)} entries")

# Finished, active orders
finished_orders = [
    r for r in orders_raw
    if r.get("is_finished") == "1" and r.get("inactive") == "0"
]
print(f"  Finished orders: {len(finished_orders)} / {len(orders_raw)} total")

# Date range from finished orders (by end_date_time)
end_dates = [parse_date(r.get("end_date_time", "")) for r in finished_orders]
end_dates = [d for d in end_dates if d]
date_from = min(end_dates)[:10] if end_dates else None
date_to   = max(end_dates)[:10] if end_dates else None

finished_order_ids = {r["order_id"] for r in finished_orders}

# ---------------------------------------------------------------------------
# 3. overview.json
# ---------------------------------------------------------------------------
print("\n=== STEP 3: overview.json ===")

total_orders  = len(finished_orders)
total_revenue = sum(safe_float(r.get("total")) for r in finished_orders)
avg_ticket    = round(total_revenue / total_orders, 2) if total_orders else 0.0

active_invoices  = [r for r in invoices_raw if r.get("inactive") == "0"]
total_invoices   = len(active_invoices)
total_invoiced   = sum(safe_float(r.get("total")) for r in active_invoices)

active_purchases = [r for r in purchases_raw if r.get("inactive") == "0"]
total_purchases  = len(active_purchases)
total_purchase_v = sum(safe_float(r.get("total")) for r in active_purchases)

total_withdrawals = sum(safe_float(r.get("amount")) for r in withdraws_raw)
total_customers   = len(customers_raw)
total_products    = len([p for p in products_raw if p.get("inactive") == "0"])

db_version = (
    parse_date(db_version_raw[0].get("date_time"))
    if db_version_raw and db_version_raw[0].get("date_time")
    else (db_version_raw[0].get("id") if db_version_raw else "unknown")
)

overview = {
    "total_orders":            total_orders,
    "total_revenue":           round(total_revenue, 2),
    "avg_ticket":              avg_ticket,
    "total_invoices":          total_invoices,
    "total_invoiced":          round(total_invoiced, 2),
    "total_purchases":         total_purchases,
    "total_purchase_amount":   round(total_purchase_v, 2),
    "total_withdrawals":       round(total_withdrawals, 2),
    "total_customers":         total_customers,
    "total_products":          total_products,
    "date_from":               date_from,
    "date_to":                 date_to,
    "db_version":              db_version,
}
write_json("overview.json", overview)

# ---------------------------------------------------------------------------
# 4. monthly_sales.json
# ---------------------------------------------------------------------------
print("\n=== STEP 4: monthly_sales.json ===")

monthly = defaultdict(lambda: {"orders": 0, "revenue": 0.0})
for r in finished_orders:
    iso = parse_date(r.get("end_date_time", ""))
    if not iso:
        continue
    month = iso[:7]
    monthly[month]["orders"]  += 1
    monthly[month]["revenue"] += safe_float(r.get("total"))

monthly_sales = sorted(
    [
        {
            "month":      m,
            "orders":     d["orders"],
            "revenue":    round(d["revenue"], 2),
            "avg_ticket": round(d["revenue"] / d["orders"], 2) if d["orders"] else 0.0,
        }
        for m, d in monthly.items()
    ],
    key=lambda x: x["month"],
)
write_json("monthly_sales.json", monthly_sales)

# ---------------------------------------------------------------------------
# 5. daily_sales.json
# ---------------------------------------------------------------------------
print("\n=== STEP 5: daily_sales.json ===")

daily = defaultdict(lambda: {"orders": 0, "revenue": 0.0})
for r in finished_orders:
    iso = parse_date(r.get("end_date_time", ""))
    if not iso:
        continue
    day = iso[:10]
    daily[day]["orders"]  += 1
    daily[day]["revenue"] += safe_float(r.get("total"))

daily_sales = sorted(
    [
        {
            "date":    d,
            "orders":  v["orders"],
            "revenue": round(v["revenue"], 2),
        }
        for d, v in daily.items()
    ],
    key=lambda x: x["date"],
)
write_json("daily_sales.json", daily_sales)

# ---------------------------------------------------------------------------
# 6. top_products.json
# ---------------------------------------------------------------------------
print("\n=== STEP 6: top_products.json ===")

product_agg = defaultdict(lambda: {"name": "", "quantity": 0.0, "revenue": 0.0})
for r in order_items_raw:
    if r.get("order_id") not in finished_order_ids:
        continue
    pid  = r.get("product_id", "")
    name = clean_str(r.get("product_name")) or product_map.get(pid, {}).get("name", pid)
    if not name:
        continue
    product_agg[name]["name"]     = name
    product_agg[name]["quantity"] += safe_float(r.get("quantity"))
    product_agg[name]["revenue"]  += safe_float(r.get("total"))

top_products = sorted(
    [
        {
            "name":      d["name"],
            "quantity":  round(d["quantity"], 2),
            "revenue":   round(d["revenue"], 2),
            "avg_price": round(d["revenue"] / d["quantity"], 2) if d["quantity"] else 0.0,
        }
        for d in product_agg.values()
    ],
    key=lambda x: x["revenue"],
    reverse=True,
)[:50]
write_json("top_products.json", top_products)

# ---------------------------------------------------------------------------
# 7. sales_by_waiter.json
# ---------------------------------------------------------------------------
print("\n=== STEP 7: sales_by_waiter.json ===")

waiter_agg = defaultdict(lambda: {"orders": 0, "revenue": 0.0})
for r in finished_orders:
    u = clean_str(r.get("user_name")) or "UNKNOWN"
    waiter_agg[u]["orders"]  += 1
    waiter_agg[u]["revenue"] += safe_float(r.get("total"))

removals_by_user = defaultdict(int)
for r in removed_items_raw:
    removals_by_user[clean_str(r.get("user_name")) or "UNKNOWN"] += 1

discounts_by_user = defaultdict(float)
for r in rest_disc_raw + del_disc_raw:
    u = clean_str(r.get("user_name")) or "UNKNOWN"
    discounts_by_user[u] += abs(safe_float(r.get("discount")))

sales_by_waiter = sorted(
    [
        {
            "user_name":  u,
            "orders":     d["orders"],
            "revenue":    round(d["revenue"], 2),
            "avg_ticket": round(d["revenue"] / d["orders"], 2) if d["orders"] else 0.0,
            "removals":   removals_by_user.get(u, 0),
            "discounts":  round(discounts_by_user.get(u, 0.0), 2),
        }
        for u, d in waiter_agg.items()
    ],
    key=lambda x: x["revenue"],
    reverse=True,
)
write_json("sales_by_waiter.json", sales_by_waiter)

# ---------------------------------------------------------------------------
# 8. payment_breakdown.json
# ---------------------------------------------------------------------------
print("\n=== STEP 8: payment_breakdown.json ===")

pay_totals = {
    "efectivo":    0.0,
    "debito":      0.0,
    "credito":     0.0,
    "mercadopago": 0.0,
    "pedidos_ya":  0.0,
    "other":       0.0,
}
for r in order_payments_raw:
    pay_totals["efectivo"]    += safe_float(r.get("cash"))
    pay_totals["debito"]      += safe_float(r.get("debit_card"))
    pay_totals["credito"]     += safe_float(r.get("credit_card"))
    pay_totals["mercadopago"] += safe_float(r.get("mercadopago"))
    pay_totals["pedidos_ya"]  += safe_float(r.get("pedidos_ya"))
    pay_totals["other"]       += (
        safe_float(r.get("uber_eats"))
        + safe_float(r.get("mas_delivery"))
        + safe_float(r.get("rappi"))
        + safe_float(r.get("vales"))
        + safe_float(r.get("dollar_in_pesos"))
    )

payment_breakdown = {k: round(v, 2) for k, v in pay_totals.items()}
write_json("payment_breakdown.json", payment_breakdown)

# ---------------------------------------------------------------------------
# 9. audit_removed.json   -- ALL rows from OrderRestaurantRemovedItem
# ---------------------------------------------------------------------------
print("\n=== STEP 9: audit_removed.json ===")

audit_removed = []
for r in removed_items_raw:
    order_id     = r.get("order_id", "")
    order_row    = order_map.get(order_id)
    item_dt      = parse_date(r.get("date_time", ""))
    order_start  = parse_date(order_row.get("start_date_time", "")) if order_row else None
    mins         = minutes_between(order_start, item_dt)
    is_late      = bool(mins is not None and mins > 15)
    pid          = r.get("product_id", "")

    audit_removed.append({
        "id":              safe_int(r.get("id")),
        "date_time":       item_dt,
        "order_id":        order_id,
        "product_id":      pid,
        "product_name":    product_map.get(pid, {}).get("name", pid),
        "quantity":        safe_float(r.get("quantity")),
        "total":           safe_float(r.get("total")),
        "observation":     clean_str(r.get("observation")),
        "user_name":       clean_str(r.get("user_name")),
        "order_start":     order_start,
        "minutes_elapsed": mins,
        "is_late":         is_late,
    })

write_json("audit_removed.json", audit_removed)

# ---------------------------------------------------------------------------
# 10. audit_discounts.json
# ---------------------------------------------------------------------------
print("\n=== STEP 10: audit_discounts.json ===")

audit_discounts = []
for source, rows in [("restaurant", rest_disc_raw), ("delivery", del_disc_raw)]:
    for r in rows:
        audit_discounts.append({
            "id":                  safe_int(r.get("id")),
            "order_id":            r.get("order_id", ""),
            "date_time":           parse_date(r.get("date_time", "")),
            "total":               safe_float(r.get("total")),
            "discount_percentage": safe_float(r.get("discount_percentage")),
            "discount":            safe_float(r.get("discount")),
            "observation":         clean_str(r.get("observation")),
            "user_name":           clean_str(r.get("user_name")),
            "source":              source,
        })
audit_discounts.sort(key=lambda x: x.get("date_time") or "")
write_json("audit_discounts.json", audit_discounts)

# ---------------------------------------------------------------------------
# 11. audit_prices.json
# ---------------------------------------------------------------------------
print("\n=== STEP 11: audit_prices.json ===")

audit_prices = []
for source, rows in [("restaurant", rest_price_raw), ("delivery", del_price_raw)]:
    for r in rows:
        pid = r.get("product_id", "")
        audit_prices.append({
            "id":           safe_int(r.get("id")),
            "date_time":    parse_date(r.get("date_time", "")),
            "order_id":     r.get("order_id", ""),
            "product_id":   pid,
            "product_name": product_map.get(pid, {}).get("name", pid),
            "old_price":    safe_float(r.get("old_price")),
            "new_price":    safe_float(r.get("new_price")),
            "total":        safe_float(r.get("total")),
            "observation":  clean_str(r.get("observation")),
            "user_name":    clean_str(r.get("user_name")),
            "quantity":     safe_float(r.get("quantity")),
            "source":       source,
        })
audit_prices.sort(key=lambda x: x.get("date_time") or "")
write_json("audit_prices.json", audit_prices)

# ---------------------------------------------------------------------------
# 12. audit_quantities.json
# ---------------------------------------------------------------------------
print("\n=== STEP 12: audit_quantities.json ===")

audit_quantities = []
for r in rest_qty_raw:
    pid = r.get("product_id", "")
    audit_quantities.append({
        "id":           safe_int(r.get("id")),
        "date_time":    parse_date(r.get("date_time", "")),
        "order_id":     r.get("order_id", ""),
        "product_id":   pid,
        "product_name": product_map.get(pid, {}).get("name", pid),
        "old_quantity": safe_float(r.get("old_quantity")),
        "new_quantity": safe_float(r.get("new_quantity")),
        "total":        safe_float(r.get("total")),
        "observation":  clean_str(r.get("observation")),
        "user_name":    clean_str(r.get("user_name")),
    })
audit_quantities.sort(key=lambda x: x.get("date_time") or "")
write_json("audit_quantities.json", audit_quantities)

# ---------------------------------------------------------------------------
# 13. audit_payment_types.json   -- ALL 11587 rows
# ---------------------------------------------------------------------------
print("\n=== STEP 13: audit_payment_types.json ===")

audit_payment_types = []
for r in audit_pay_raw:
    audit_payment_types.append({
        "id":                    safe_int(r.get("id")),
        "username":              clean_str(r.get("username")),
        "order_id":              r.get("order_id", ""),
        "date_time":             parse_date(r.get("date_time", "")),
        "total":                 safe_float(r.get("total")),
        "original_payment_type": clean_str(r.get("original_payment_type")),
        "modified_payment_type": clean_str(r.get("modified_payment_type")),
        "observation":           clean_str(r.get("observation")),
    })
write_json("audit_payment_types.json", audit_payment_types)

# ---------------------------------------------------------------------------
# 14. audit_inactivations.json   -- ALL 1077 rows
# ---------------------------------------------------------------------------
print("\n=== STEP 14: audit_inactivations.json ===")

audit_inactivations = []
for r in inactivation_raw:
    audit_inactivations.append({
        "id":          safe_int(r.get("id")),
        "date_time":   parse_date(r.get("date_time", "")),
        "order_id":    r.get("order_id", ""),
        "observation": clean_str(r.get("observation")),
        "user_name":   clean_str(r.get("user_name")),
    })
write_json("audit_inactivations.json", audit_inactivations)

# ---------------------------------------------------------------------------
# 15. audit_summary.json
# ---------------------------------------------------------------------------
print("\n=== STEP 15: audit_summary.json ===")

late_items  = [r for r in audit_removed if r.get("is_late")]
late_amount = round(sum(abs(r.get("total", 0)) for r in late_items), 2)

# Payment changes by user (username field)
pay_ch_by_user = defaultdict(lambda: {"count": 0, "total_amount": 0.0})
for r in audit_payment_types:
    u = clean_str(r.get("username")) or "UNKNOWN"
    pay_ch_by_user[u]["count"]        += 1
    pay_ch_by_user[u]["total_amount"] += abs(safe_float(r.get("total")))
pay_ch_list = sorted(
    [{"user": u, "count": d["count"], "total_amount": round(d["total_amount"], 2)}
     for u, d in pay_ch_by_user.items()],
    key=lambda x: x["count"], reverse=True,
)

# Inactivations by user
inact_by_user = defaultdict(int)
for r in audit_inactivations:
    inact_by_user[clean_str(r.get("user_name")) or "UNKNOWN"] += 1
inact_list = sorted(
    [{"user": u, "count": c} for u, c in inact_by_user.items()],
    key=lambda x: x["count"], reverse=True,
)

audit_summary = {
    "removed_items": {
        "count":            len(audit_removed),
        "total_amount":     round(sum(abs(r.get("total", 0)) for r in audit_removed), 2),
        "late_count":       len(late_items),
        "late_amount":      late_amount,
        "by_user":          agg_by_user(audit_removed),
        "top_observations": top_observations(audit_removed),
    },
    "discounts": {
        "count":        len(audit_discounts),
        "total_amount": round(sum(abs(r.get("discount", 0)) for r in audit_discounts), 2),
        "by_user":      agg_by_user(audit_discounts, amount_key="discount"),
    },
    "prices": {
        "count":        len(audit_prices),
        "total_amount": round(sum(abs(r.get("total", 0)) for r in audit_prices), 2),
        "by_user":      agg_by_user(audit_prices),
    },
    "quantities": {
        "count":        len(audit_quantities),
        "total_amount": round(sum(abs(r.get("total", 0)) for r in audit_quantities), 2),
        "by_user":      agg_by_user(audit_quantities),
    },
    "payment_type_changes": {
        "count":   len(audit_payment_types),
        "by_user": pay_ch_list,
    },
    "inactivations": {
        "count":   len(audit_inactivations),
        "by_user": inact_list,
    },
}
write_json("audit_summary.json", audit_summary)

# ---------------------------------------------------------------------------
# 16. suspicious_patterns.json
# ---------------------------------------------------------------------------
print("\n=== STEP 16: suspicious_patterns.json ===")

# Users with >50 removals
high_removals_users = [
    d for d in audit_summary["removed_items"]["by_user"]
    if d["count"] > 50
]

# Late removals detail (already computed)
late_removals = sorted(
    [
        {
            "id":              r["id"],
            "date_time":       r["date_time"],
            "order_id":        r["order_id"],
            "product_name":    r["product_name"],
            "user_name":       r["user_name"],
            "minutes_elapsed": r["minutes_elapsed"],
            "total":           r["total"],
            "observation":     r["observation"],
        }
        for r in audit_removed if r.get("is_late")
    ],
    key=lambda x: (x.get("minutes_elapsed") or 0),
    reverse=True,
)

# Suspicious observations: empty or just "X" (case-insensitive)
suspicious_observations = [
    {
        "id":           r["id"],
        "date_time":    r["date_time"],
        "order_id":     r["order_id"],
        "product_name": r["product_name"],
        "user_name":    r["user_name"],
        "observation":  r["observation"],
        "total":        r["total"],
    }
    for r in audit_removed
    if r.get("observation", "").strip().upper() in ("", "X", "XX", "X ", " X")
]

# Large discounts: discount_percentage > 20
large_discounts = sorted(
    [
        {
            "id":                  r["id"],
            "order_id":            r["order_id"],
            "date_time":           r["date_time"],
            "user_name":           r["user_name"],
            "total":               r["total"],
            "discount_percentage": r["discount_percentage"],
            "discount":            r["discount"],
            "source":              r["source"],
        }
        for r in audit_discounts
        if r.get("discount_percentage", 0) > 20
    ],
    key=lambda x: x.get("discount_percentage", 0),
    reverse=True,
)

# Payment changes per user (top changers)
payment_changes_per_user = pay_ch_list[:20]

# Frequent inactivators
frequent_inactivators = inact_list[:20]

suspicious_patterns = {
    "high_removals_users":      high_removals_users,
    "late_removals":            late_removals,
    "suspicious_observations":  suspicious_observations,
    "large_discounts":          large_discounts,
    "payment_changes_per_user": payment_changes_per_user,
    "frequent_inactivators":    frequent_inactivators,
}
write_json("suspicious_patterns.json", suspicious_patterns)

# ---------------------------------------------------------------------------
# 17. caja_daily.json
# ---------------------------------------------------------------------------
print("\n=== STEP 17: caja_daily.json ===")

caja_day = defaultdict(lambda: {"cash_in": 0.0, "withdrawals": 0.0})

for r in cash_drawer_raw:
    day = parse_date_only(r.get("date_time", ""))
    if not day:
        continue
    inc = safe_float(r.get("income"))
    out = safe_float(r.get("outcome"))
    caja_day[day]["cash_in"]     += inc
    caja_day[day]["withdrawals"] += out  # outcome in CashDrawerItem = withdrawals/outflows

# Also account for explicit Withdraw records by day
for r in withdraws_raw:
    day = parse_date_only(r.get("date_time", ""))
    if day:
        caja_day[day]  # ensure key exists

caja_daily = sorted(
    [
        {
            "date":        d,
            "cash_in":     round(v["cash_in"], 2),
            "withdrawals": round(v["withdrawals"], 2),
            "net":         round(v["cash_in"] - v["withdrawals"], 2),
        }
        for d, v in caja_day.items()
    ],
    key=lambda x: x["date"],
)
write_json("caja_daily.json", caja_daily)

# ---------------------------------------------------------------------------
# 18. withdrawals.json
# ---------------------------------------------------------------------------
print("\n=== STEP 18: withdrawals.json ===")

withdrawals_out = []
for r in withdraws_raw:
    withdrawals_out.append({
        "id":          safe_int(r.get("id")),
        "date_time":   parse_date(r.get("date_time", "")),
        "amount":      safe_float(r.get("amount")),
        "user_name":   clean_str(r.get("user_name")),
        "observation": clean_str(r.get("description") or r.get("observation")),
    })
withdrawals_out.sort(key=lambda x: x.get("date_time") or "")
write_json("withdrawals.json", withdrawals_out)

# ---------------------------------------------------------------------------
# 19. proveedores.json
# ---------------------------------------------------------------------------
print("\n=== STEP 19: proveedores.json ===")

sup_purch = defaultdict(lambda: {"count": 0, "total": 0.0})
for r in active_purchases:
    sid = r.get("supplier_id", "")
    sup_purch[sid]["count"] += 1
    sup_purch[sid]["total"] += safe_float(r.get("total"))

proveedores = []
for s in supplier_raw:
    pid  = s.get("party_id", "")
    name = party_map.get(pid, f"Supplier {pid}")
    sp   = sup_purch.get(pid, {"count": 0, "total": 0.0})
    proveedores.append({
        "party_id":       pid,
        "name":           name,
        "code":           clean_str(s.get("code")),
        "contact_name":   clean_str(s.get("contact_name")),
        "cuit":           clean_str(s.get("cuit")),
        "tax_condition":  s.get("tax_condition", ""),
        "balance":        safe_float(s.get("balance")),
        "purchase_count": sp["count"],
        "purchase_total": round(sp["total"], 2),
    })
proveedores.sort(key=lambda x: x["purchase_total"], reverse=True)
write_json("proveedores.json", proveedores)

# ---------------------------------------------------------------------------
# 20. clientes.json   -- top 100 customers by |balance|
# ---------------------------------------------------------------------------
print("\n=== STEP 20: clientes.json ===")

TAX_CONDITIONS = {
    0: "Consumidor Final",
    1: "Responsable Inscripto",
    2: "Monotributista",
    3: "Exento",
    4: "No Responsable",
}

clientes = []
for c in customers_raw:
    pid     = c.get("party_id", "")
    name    = party_map.get(pid, f"Customer {pid}")
    balance = safe_float(c.get("balance"))
    tc_raw  = safe_int(c.get("tax_condition"))
    clientes.append({
        "party_id":      pid,
        "name":          name,
        "balance":       round(balance, 2),
        "tax_condition": TAX_CONDITIONS.get(tc_raw, str(tc_raw)),
        "date_created":  parse_date(c.get("date_created", "")),
    })
clientes.sort(key=lambda x: abs(x["balance"]), reverse=True)
clientes = clientes[:100]
write_json("clientes.json", clientes)

# ---------------------------------------------------------------------------
# 21. products.json
# ---------------------------------------------------------------------------
print("\n=== STEP 21: products.json ===")

products_out = []
for r in products_raw:
    rid = r.get("rubro_id", "")
    products_out.append({
        "product_id":      r.get("product_id", ""),
        "code":            clean_str(r.get("code")),
        "name":            clean_str(r.get("name")),
        "rubro_id":        rid,
        "rubro_name":      rubro_map.get(rid, ""),
        "price":           safe_float(r.get("price")),
        "cost":            safe_float(r.get("cost")),
        "alicuota":        safe_float(r.get("alicuota")),
        "inactive":        safe_int(r.get("inactive")),
        "is_for_sale":     safe_int(r.get("is_for_sale")),
        "product_type":    r.get("product_type", ""),
        "show_delivery":   safe_int(r.get("show_delivery")),
        "show_restaurant": safe_int(r.get("show_restaurant")),
        "ask_price":       safe_int(r.get("ask_price")),
    })
products_out.sort(key=lambda x: (x["rubro_name"], x["name"]))
write_json("products.json", products_out)

# ---------------------------------------------------------------------------
# 22. ai_context.json
# ---------------------------------------------------------------------------
print("\n=== STEP 22: ai_context.json ===")

best_month   = max(monthly_sales, key=lambda x: x["revenue"]) if monthly_sales else {}
best_product = top_products[0] if top_products else {}
top_waiter   = sales_by_waiter[0] if sales_by_waiter else {}
top_removal_user = audit_summary["removed_items"]["by_user"][0] if audit_summary["removed_items"]["by_user"] else {}
top_pay_changer  = pay_ch_list[0] if pay_ch_list else {}

business_summary = (
    f"Argentine restaurant POS database spanning {date_from} to {date_to}. "
    f"Total {total_orders:,} finished orders generating ${total_revenue:,.2f} ARS in revenue "
    f"with an average ticket of ${avg_ticket:,.2f} ARS. "
    f"Best month: {best_month.get('month', '?')} with {best_month.get('orders', 0):,} orders "
    f"and ${best_month.get('revenue', 0):,.2f} ARS. "
    f"Top product by revenue: {best_product.get('name', '?')}. "
    f"Top waiter: {top_waiter.get('user_name', '?')} ({top_waiter.get('orders', 0):,} orders). "
    f"System has {total_customers} customers, {total_products} active products, "
    f"{len(supplier_raw)} suppliers. "
    f"Payment channels: efectivo, debito, credito, MercadoPago, PedidosYa. "
    f"Audit: {len(audit_removed):,} removed items, {len(audit_discounts):,} discounts, "
    f"{len(audit_prices):,} price changes, {len(audit_payment_types):,} payment type changes, "
    f"{len(audit_inactivations):,} order inactivations."
)

audit_findings = (
    f"REMOVED ITEMS: {len(audit_removed):,} total removals worth "
    f"${audit_summary['removed_items']['total_amount']:,.2f} ARS. "
    f"{len(late_items):,} items removed >15 min after order start (possibly already prepared). "
    f"Top removal user: {top_removal_user.get('user', '?')} ({top_removal_user.get('count', 0)} removals). "
    f"DISCOUNTS: {len(audit_discounts):,} discount events totaling "
    f"${audit_summary['discounts']['total_amount']:,.2f} ARS. "
    f"Large discounts (>20%): {len(large_discounts)}. "
    f"PRICE CHANGES: {len(audit_prices):,} events. "
    f"PAYMENT TYPE CHANGES: {len(audit_payment_types):,} — top changer "
    f"{top_pay_changer.get('user', '?')} with {top_pay_changer.get('count', 0):,} changes. "
    f"INACTIVATIONS: {len(audit_inactivations):,} orders inactivated. "
    f"SUSPICIOUS OBS: {len(suspicious_observations)} removals with empty or 'X' observation."
)

ai_context = {
    "business_summary": business_summary,
    "key_metrics":      overview,
    "audit_findings":   audit_findings,
    "monthly_trend":    monthly_sales,
    "top_products":     top_products[:10],
    "audit_summary":    audit_summary,
}
write_json("ai_context.json", ai_context)

# ---------------------------------------------------------------------------
# Final summary
# ---------------------------------------------------------------------------
print("\n=== EXPORT COMPLETE ===")
print(f"\nOutput directory: {OUT_DIR}\n")

files_written = sorted(
    [(f.name, f.stat().st_size) for f in OUT_DIR.iterdir() if f.suffix == ".json"],
    key=lambda x: x[0],
)
print(f"  {'Filename':<45} {'Size':>12}")
print(f"  {'-'*45} {'-'*12}")
for fname, size in files_written:
    print(f"  {fname:<45} {size:>10,} bytes")

total_size = sum(s for _, s in files_written)
print(f"\n  Total: {len(files_written)} files, {total_size:,} bytes ({total_size / 1024 / 1024:.2f} MB)")
print("\nDone.")
