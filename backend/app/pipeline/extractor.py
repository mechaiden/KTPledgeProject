"""Pull structured fields out of Dolphin's markdown.

Dolphin tends to flatten a receipt into a few long lines, e.g.
  "## MAPLE STREET OFFICE SUPPLY 482 Maple Street ...
   Date: 10/14/2026 ... Printer Paper 500ct 2 @ $8.49 $16.98 ... SUBTOTAL $86.58 SALES TAX 7.0% $6.06 TOTAL $92.64"
so these patterns search the whole text rather than going line by line.
"""

import datetime as dt
import re
from dataclasses import dataclass, field

MONEY = r"\$?\s?(\d{1,3}(?:,\d{3})*\.\d{2})"

# "Printer Paper 500ct 2 @ $8.49 $16.98". The line total is optional because Dolphin sometimes drops it.
# Names can't contain ':', '#' or '-' so the match doesn't swallow "Date: ..." or the dashed divider lines.
ITEM_PATTERN = re.compile(
    rf"([A-Za-z][A-Za-z0-9 .&'/]*?)\s+(\d+)\s?@\s?{MONEY}(?:\s+{MONEY})?"
)


@dataclass
class ExtractedItem:
    name: str
    qty: int | None
    total: float | None


@dataclass
class ExtractedReceipt:
    merchant: str | None = None
    date: dt.date | None = None
    subtotal: float | None = None
    tax: float | None = None
    total: float | None = None
    items: list[ExtractedItem] = field(default_factory=list)


def _to_money(s: str) -> float:
    return float(s.replace(",", ""))


def _find_amount(label: str, text: str) -> float | None:
    # \b keeps "total" from matching inside "subtotal"; the optional % handles "SALES TAX 7.0% $6.06"
    match = re.search(rf"\b{label}\b:?\s*(?:\d+(?:\.\d+)?%\s*)?{MONEY}", text, re.IGNORECASE)
    return _to_money(match.group(1)) if match else None


def _find_date(text: str) -> dt.date | None:
    if match := re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", text):
        year, month, day = match.groups()
    elif match := re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{2}|\d{4})\b", text):
        month, day, year = match.groups()
        if len(year) == 2:
            year = "20" + year
    else:
        return None
    try:
        return dt.date(int(year), int(month), int(day))
    except ValueError:
        return None


def _find_merchant(text: str) -> str | None:
    for line in text.splitlines():
        line = line.strip().lstrip("#").strip()
        if not line:
            continue
        # The store name comes first, then usually the street number
        name = re.split(r"\s+\d", line, maxsplit=1)[0].strip(" ,")
        if not name:
            continue
        return name.title() if name.isupper() else name
    return None


def _find_items(text: str) -> list[ExtractedItem]:
    return [
        ExtractedItem(
            name=name.strip(),
            qty=int(qty),
            total=_to_money(line_total) if line_total else None,
        )
        for name, qty, _unit_price, line_total in ITEM_PATTERN.findall(text)
    ]


def extract_fields(text: str) -> ExtractedReceipt:
    return ExtractedReceipt(
        merchant=_find_merchant(text),
        date=_find_date(text),
        subtotal=_find_amount("subtotal", text),
        tax=_find_amount("tax", text),
        total=_find_amount("total", text),
        items=_find_items(text),
    )
