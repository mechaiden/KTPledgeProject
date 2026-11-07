"""Spending stats computed from a list of receipts.

Nothing here touches the database or FastAPI, so every stat can be tested with hand-made receipts.
Callers pass in only receipts that should count (see counted_receipts in insights_routes.py).
"""

import datetime as dt
from collections import Counter, defaultdict
from statistics import median

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def money(amount: float) -> float:
    """Amounts are stored as floats, so sums come out like 86.99999999; round them for display."""
    return round(amount, 2)


# --- Month helpers. Months are "YYYY-MM" strings, e.g. "2026-11" ---


def month_key(date: dt.date) -> str:
    return f"{date.year:04d}-{date.month:02d}"


def previous_month(month: str) -> str:
    year, m = map(int, month.split("-"))
    return f"{year - 1:04d}-12" if m == 1 else f"{year:04d}-{m - 1:02d}"


def last_n_months(end_month: str, n: int) -> list[str]:
    """The n months ending with end_month, oldest first."""
    months = [end_month]
    while len(months) < n:
        months.insert(0, previous_month(months[0]))
    return months


def month_bounds(month: str) -> tuple[dt.date, dt.date]:
    """First day of the month, and first day of the next month (exclusive end)."""
    year, m = map(int, month.split("-"))
    start = dt.date(year, m, 1)
    end = dt.date(year + 1, 1, 1) if m == 12 else dt.date(year, m + 1, 1)
    return start, end


# --- Stats ---


def spend_by_category(receipts, month: str) -> list[dict]:
    """Spending per category in `month`, with the change from the month before."""
    prev = previous_month(month)
    current, before = defaultdict(float), defaultdict(float)
    for r in receipts:
        category = r.category or "Other"
        key = month_key(r.date)
        if key == month:
            current[category] += r.total
        elif key == prev:
            before[category] += r.total
    categories = sorted(set(current) | set(before), key=lambda c: (-current[c], c))
    return [
        {
            "category": c,
            "total": money(current[c]),
            "prev_total": money(before[c]),
            "change": money(current[c] - before[c]),
        }
        for c in categories
    ]


def monthly_trend(receipts, end_month: str, months: int) -> list[dict]:
    """Total per month, split by category, oldest first. Months with no receipts are included as 0."""
    by_month = {m: defaultdict(float) for m in last_n_months(end_month, months)}
    for r in receipts:
        key = month_key(r.date)
        if key in by_month:
            by_month[key][r.category or "Other"] += r.total
    return [
        {
            "month": m,
            "total": money(sum(cats.values())),
            "by_category": {c: money(v) for c, v in cats.items()},
        }
        for m, cats in by_month.items()
    ]


def top_merchants(receipts, limit: int = 10) -> list[dict]:
    """Biggest merchants by total spent, grouped by merchant_key so spellings of one store count together."""
    groups = defaultdict(list)
    for r in receipts:
        if r.merchant_key:
            groups[r.merchant_key].append(r)
    rows = []
    for key, rs in groups.items():
        total = sum(r.total for r in rs)
        # The key is lowercase ("trader joes"), so show the spelling printed most often instead
        name = Counter(r.merchant for r in rs).most_common(1)[0][0]
        rows.append({
            "merchant_key": key,
            "name": name,
            "visits": len(rs),
            "total": money(total),
            "avg_per_visit": money(total / len(rs)),
        })
    rows.sort(key=lambda row: (-row["total"], row["merchant_key"]))
    return rows[:limit]


def weekday_pattern(receipts) -> list[dict]:
    """Total spent and number of receipts for each weekday, Monday first."""
    totals = [0.0] * 7
    visits = [0] * 7
    for r in receipts:
        day = r.date.weekday()
        totals[day] += r.total
        visits[day] += 1
    return [
        {"weekday": WEEKDAYS[i], "total": money(totals[i]), "visits": visits[i]}
        for i in range(7)
    ]


def receipt_size_by_category(receipts) -> list[dict]:
    """Typical receipt size per category. The median is included because one big trip skews the average."""
    groups = defaultdict(list)
    for r in receipts:
        groups[r.category or "Other"].append(r.total)
    rows = [
        {
            "category": c,
            "count": len(totals),
            "average": money(sum(totals) / len(totals)),
            "median": money(median(totals)),
        }
        for c, totals in groups.items()
    ]
    rows.sort(key=lambda row: (-row["average"], row["category"]))
    return rows


def savings(receipts) -> dict:
    """Discounts and tax added up. Discounts are stored as positive numbers."""
    return {
        "discount_total": money(sum(r.discount or 0 for r in receipts)),
        "tax_total": money(sum(r.tax or 0 for r in receipts)),
        "receipt_count": len(receipts),
    }
