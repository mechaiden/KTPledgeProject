"""Extractor tests. To add a receipt: save Dolphin's recognition_json output in fixtures/ and assert on it."""

import datetime as dt
import json
from pathlib import Path

import pytest

from app.pipeline.extractor import extract_fields
from app.pipeline.parser import elements_to_text

FIXTURES = Path(__file__).parent / "fixtures"


def items_of(receipt):
    return [(i.name, i.qty, i.total) for i in receipt.items]


def test_maple_street_real_dolphin_output():
    # Layout: name / "qty @ unit" / line total, with one line total missing from the OCR
    text = elements_to_text(json.loads((FIXTURES / "maple_street.json").read_text()))
    r = extract_fields(text)

    assert r.merchant == "Maple Street Office Supply"
    assert r.date == dt.date(2026, 10, 14)
    assert (r.subtotal, r.tax, r.total) == (86.58, 6.06, 92.64)
    assert items_of(r) == [
        ("Printer Paper 500ct", 2, 16.98),
        ("Black Ink Cartridge", 1, 34.99),
        ("Shipping Labels 100", 1, 12.75),  # worked out from 1 @ $12.75
        ("Packing Tape 3pk", 1, 9.29),
        ("Ballpoint Pens 12pk", 3, 12.57),
    ]


VOLTLINE_ITEMS = [
    ("USB-C Cable 6ft", 1, 24.74),
    ("Power Bank 10k", 3, 29.70),
    ("Phone Case", 1, 59.54),
    ("Surge Protector", 3, 114.60),
    ("Earbuds", 2, 100.84),
    ("HDMI Cable", 1, 62.62),
]

# Layout: "name price" on one line, "qty @ unit" on the line after
VOLTLINE_SAME_LINE = """VOLTLINE ELECTRONICS
4606 Main Ave, Athens, GA 30601
(555) 328-3286
2026-02-22 17:47 #TEST-391369
--------------------------------------
USB-C Cable 6ft 24.74
Power Bank 10k 29.70
3 @ 9.90
Phone Case 59.54
Surge Protector 114.60
3 @ 38.20
Earbuds 100.84
2 @ 50.42
HDMI Cable 62.62
--------------------------------------
SUBTOTAL 392.04
DISCOUNT -39.20
TAX 24.70
TOTAL 377.54
PAID: AMEX ****0000
THANK YOU!
*** SAMPLE - TEST DATA ***"""

# Same receipt with every price on its own line, which Dolphin also does
VOLTLINE_SPLIT_LINES = """VOLTLINE ELECTRONICS
4606 Main Ave, Athens, GA 30601
(555) 328-3286
2026-02-22 17:47 #TEST-391369
USB-C Cable 6ft
24.74
Power Bank 10k
29.70
3 @ 9.90
Phone Case
59.54
Surge Protector
114.60
3 @ 38.20
Earbuds
100.84
2 @ 50.42
HDMI Cable
62.62
SUBTOTAL
392.04
DISCOUNT
-39.20
TAX
24.70
TOTAL
377.54
PAID: AMEX ****0000"""


@pytest.mark.parametrize("text", [VOLTLINE_SAME_LINE, VOLTLINE_SPLIT_LINES], ids=["same-line", "split-lines"])
def test_voltline(text):
    r = extract_fields(text)
    assert r.merchant == "Voltline Electronics"
    assert r.date == dt.date(2026, 2, 22)
    assert (r.subtotal, r.tax, r.total) == (392.04, 24.70, 377.54)
    assert items_of(r) == VOLTLINE_ITEMS


def test_table_output_and_tax_flags():
    # Dolphin sometimes detects the item list as a table and returns HTML
    elements = [
        {"label": "sec_0", "text": "Corner Cafe\nMar 3, 2026", "reading_order": 0},
        {
            "label": "tab",
            "text": "<table><tr><td>Latte</td><td>4.50 T</td></tr><tr><td>Bagel &amp; Cream Cheese</td>"
                    "<td>3.25</td></tr><tr><td>Total</td><td>$7.75</td></tr></table>",
            "reading_order": 1,
        },
    ]
    r = extract_fields(elements_to_text(elements))
    assert r.merchant == "Corner Cafe"
    assert r.date == dt.date(2026, 3, 3)
    assert r.total == 7.75
    assert items_of(r) == [("Latte", 1, 4.50), ("Bagel & Cream Cheese", 1, 3.25)]
