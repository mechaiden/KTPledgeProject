import datetime as dt
from types import SimpleNamespace

from app import insights


def receipt(date, total, category="Dining", merchant="Chipotle", merchant_key="chipotle", discount=None, tax=None):
    """A stand-in for a Receipt row; the stats only read attributes, so no database is needed."""
    return SimpleNamespace(date=date, total=total, category=category, merchant=merchant,
                           merchant_key=merchant_key, discount=discount, tax=tax)


NOV = dt.date(2026, 11, 3)
OCT = dt.date(2026, 10, 15)


def test_month_helpers():
    assert insights.previous_month("2026-11") == "2026-10"
    assert insights.previous_month("2026-01") == "2025-12"
    assert insights.last_n_months("2026-02", 4) == ["2025-11", "2025-12", "2026-01", "2026-02"]
    assert insights.month_bounds("2026-12") == (dt.date(2026, 12, 1), dt.date(2027, 1, 1))


def test_spend_by_category_compares_with_last_month():
    rows = insights.spend_by_category(
        [receipt(NOV, 80.0), receipt(OCT, 18.0), receipt(NOV, 40.0, category="Groceries")],
        "2026-11",
    )
    assert rows == [
        {"category": "Dining", "total": 80.0, "prev_total": 18.0, "change": 62.0},
        {"category": "Groceries", "total": 40.0, "prev_total": 0.0, "change": 40.0},
    ]


def test_spend_by_category_keeps_categories_only_spent_on_last_month():
    [row] = insights.spend_by_category([receipt(OCT, 25.0, category="Travel")], "2026-11")
    assert row == {"category": "Travel", "total": 0.0, "prev_total": 25.0, "change": -25.0}


def test_uncategorized_receipts_count_as_other():
    [row] = insights.spend_by_category([receipt(NOV, 5.0, category=None)], "2026-11")
    assert row["category"] == "Other"


def test_monthly_trend_fills_empty_months():
    trend = insights.monthly_trend(
        [receipt(NOV, 10.0), receipt(NOV, 5.0, category="Groceries"), receipt(dt.date(2026, 9, 1), 7.0)],
        "2026-11", 3,
    )
    assert [m["month"] for m in trend] == ["2026-09", "2026-10", "2026-11"]
    assert trend[1] == {"month": "2026-10", "total": 0.0, "by_category": {}}
    assert trend[2]["total"] == 15.0
    assert trend[2]["by_category"] == {"Dining": 10.0, "Groceries": 5.0}


def test_top_merchants_groups_spellings_of_one_store():
    rows = insights.top_merchants([
        receipt(NOV, 10.0, merchant="CHIPOTLE #1234"),
        receipt(NOV, 12.0, merchant="Chipotle"),
        receipt(NOV, 14.0, merchant="Chipotle"),
        receipt(NOV, 50.0, merchant="Target", merchant_key="target", category="Shopping"),
    ])
    assert rows[0]["merchant_key"] == "target"
    assert rows[1] == {"merchant_key": "chipotle", "name": "Chipotle", "visits": 3,
                       "total": 36.0, "avg_per_visit": 12.0}


def test_top_merchants_skips_receipts_without_a_merchant_and_respects_limit():
    rs = [receipt(NOV, 1.0, merchant=None, merchant_key=None)] + [
        receipt(NOV, float(i), merchant=f"Shop {i}", merchant_key=f"shop {i}") for i in range(1, 6)
    ]
    rows = insights.top_merchants(rs, limit=2)
    assert [r["merchant_key"] for r in rows] == ["shop 5", "shop 4"]


def test_weekday_pattern():
    rows = insights.weekday_pattern([receipt(dt.date(2026, 11, 2), 10.0), receipt(dt.date(2026, 11, 9), 5.0)])
    assert len(rows) == 7
    assert rows[0] == {"weekday": "Monday", "total": 15.0, "visits": 2}  # both dates are Mondays
    assert rows[6] == {"weekday": "Sunday", "total": 0.0, "visits": 0}


def test_receipt_size_includes_median():
    [row] = insights.receipt_size_by_category(
        [receipt(NOV, 20.0, category="Groceries"), receipt(NOV, 30.0, category="Groceries"),
         receipt(NOV, 300.0, category="Groceries")]
    )
    assert row == {"category": "Groceries", "count": 3, "average": 116.67, "median": 30.0}


def test_savings_treats_missing_values_as_zero():
    result = insights.savings([receipt(NOV, 10.0, discount=2.5, tax=0.8), receipt(NOV, 10.0)])
    assert result == {"discount_total": 2.5, "tax_total": 0.8, "receipt_count": 2}


def test_money_rounds_float_noise():
    assert insights.money(0.1 + 0.2) == 0.3
