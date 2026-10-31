"""Pull structured fields out of the receipt text from parser.py (one receipt line per line).

Receipts put things in different orders, so items are read with a small line-by-line state machine
instead of one big regex. Layouts it handles:

    Printer Paper 500ct        USB-C Cable 6ft 24.74        Earbuds
    2 @ $8.49                  Power Bank 10k 29.70         100.84
    $16.98                     3 @ 9.90                     2 @ 50.42
"""

import datetime as dt
import re
import string
from dataclasses import dataclass, field

AMOUNT = r"-?\s?\$?\s?\d[\d,]*\.\d{2}"
# Many receipts end price lines with a tax flag like "4.99 T" or "4.99 N"
FLAG = r"(?:\s+[A-Z]{1,2})?"

PRICE_ONLY = re.compile(rf"^({AMOUNT}){FLAG}$")
NAME_AND_PRICE = re.compile(rf"^(.*?[A-Za-z].*?)\s+({AMOUNT}){FLAG}$")
# "2 @ $8.49", "3 x 9.90", "2 @ 4.19 ea 8.38"
QTY_LINE = re.compile(rf"^(\d+)\s*(?:@|x)\s*({AMOUNT})(?:\s*(?:ea|each))?(?:\s+({AMOUNT}))?$", re.IGNORECASE)
DIVIDER = re.compile(r"^[-=*_~.\s]+$")

# Checked in this order, so "subtotal" wins over "total" and "total savings" counts as a discount
SUMMARY_LABELS = [
    ("subtotal", re.compile(r"sub\s*-?\s*total", re.IGNORECASE)),
    ("discount", re.compile(r"discount|savings|coupon|promo", re.IGNORECASE)),
    ("tax", re.compile(r"\b(?:tax|hst|gst|vat)\b", re.IGNORECASE)),
    ("total", re.compile(r"\btotal\b|amount due|balance due", re.IGNORECASE)),
]

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}


@dataclass
class ExtractedItem:
    name: str
    qty: int | None = None
    unit_price: float | None = None
    total: float | None = None


@dataclass
class ExtractedReceipt:
    merchant: str | None = None
    date: dt.date | None = None
    subtotal: float | None = None
    discount: float | None = None  # always positive, however the receipt prints it
    tax: float | None = None
    total: float | None = None
    items: list[ExtractedItem] = field(default_factory=list)


def _to_money(s: str) -> float:
    return float(re.sub(r"[\s$,]", "", s))


def _summary_label(line: str) -> str | None:
    for label, pattern in SUMMARY_LABELS:
        if pattern.search(line):
            return label
    return None


def _finish(item: ExtractedItem) -> ExtractedItem:
    if item.qty is None:
        item.qty = 1
    # The OCR sometimes drops a line total but keeps "qty @ unit price", which is enough to work it out
    if item.total is None and item.unit_price is not None:
        item.total = round(item.qty * item.unit_price, 2)
    return item


def _read_lines(lines: list[str], receipt: ExtractedReceipt) -> None:
    items: list[ExtractedItem] = []
    current: ExtractedItem | None = None  # a name we've seen but haven't got a price for yet
    pending_label: str | None = None  # a summary label ("TOTAL") whose amount is on the next line
    in_items = True  # items stop at the first subtotal/total/tax line

    def close_current():
        nonlocal current
        # A lone name with no price or quantity is usually header text ("Register: 02"), not an item
        if current is not None and (current.qty is not None or current.total is not None):
            items.append(current)
        current = None

    def set_summary(label: str, amount: float):
        if label == "discount":
            # A receipt can have several: a coupon plus a loyalty discount, say
            receipt.discount = round((receipt.discount or 0) + abs(amount), 2)
        elif getattr(receipt, label) is None:
            setattr(receipt, label, amount)

    for line in lines:
        if not line or DIVIDER.match(line):
            continue

        label = _summary_label(line)
        # Before any items, a bare "Tax ID: ..." style header line isn't the start of the totals
        if label and (items or NAME_AND_PRICE.match(line)):
            close_current()
            in_items = False
            if match := NAME_AND_PRICE.match(line):
                set_summary(label, _to_money(match.group(2)))
                pending_label = None
            else:
                pending_label = label
            continue

        if match := PRICE_ONLY.match(line):
            amount = _to_money(match.group(1))
            if pending_label:
                set_summary(pending_label, amount)
                pending_label = None
            elif in_items and current is not None:
                current.total = amount
                close_current()
            continue

        # Anything after the totals (card number, "APPROVED", "Thank you") isn't an item
        if not in_items:
            continue

        if match := QTY_LINE.match(line):
            qty, unit, line_total = int(match.group(1)), _to_money(match.group(2)), match.group(3)
            # The qty line belongs to the name above it, or, when the price shares the name's line,
            # to the item just finished
            target = current if current is not None else (items[-1] if items and items[-1].qty is None else None)
            if target is not None:
                target.qty, target.unit_price = qty, unit
                if line_total:
                    target.total = _to_money(line_total)
            continue

        if match := NAME_AND_PRICE.match(line):
            current = None  # an unpriced name right before a priced one is a stray header line
            items.append(ExtractedItem(name=match.group(1).strip(), total=_to_money(match.group(2))))
            continue

        # Plain text: the start of a new item, if a price or quantity follows
        close_current()
        current = ExtractedItem(name=line)

    close_current()
    receipt.items = [_finish(item) for item in items]


def _find_date(text: str) -> dt.date | None:
    if match := re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", text):
        year, month, day = match.groups()
    elif match := re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{2}|\d{4})\b", text):
        month, day, year = match.groups()
        if len(year) == 2:
            year = "20" + year
    elif match := re.search(r"\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b", text):
        month_name, day, year = match.groups()
        month = MONTHS.get(month_name.lower())
        if month is None:
            return None
    else:
        return None
    try:
        return dt.date(int(year), int(month), int(day))
    except ValueError:
        return None


def _find_merchant(lines: list[str]) -> str | None:
    # The store name is normally the first real line of the receipt
    for line in lines:
        name = line.lstrip("#").strip()
        if len(re.findall(r"[A-Za-z]", name)) >= 3:
            return string.capwords(name) if name.isupper() else name  # .title() would give "Joe'S"
    return None


def extract_fields(text: str) -> ExtractedReceipt:
    lines = [line.strip() for line in text.splitlines()]
    receipt = ExtractedReceipt(merchant=_find_merchant(lines), date=_find_date(text))
    _read_lines(lines, receipt)
    return receipt
