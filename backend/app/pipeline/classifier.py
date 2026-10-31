import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Receipt

CATEGORIES = ["Dining", "Groceries", "Transportation", "Travel", "Shopping", "Health", "Entertainment", "Other"]

# Merchant names say much more about a purchase than one item on the receipt does
MERCHANT_WEIGHT = 3

KEYWORDS = {
    "Dining": ["restaurant", "cafe", "coffee", "pizza", "pizzeria", "grill", "kitchen", "bakery", "diner", "bistro",
               "taqueria", "bar", "pub", "chipotle", "panera", "starbucks", "dunkin", "mcdonald", "burger king",
               "wendy", "taco bell", "subway", "chick fil a", "burrito", "sandwich", "latte"],
    "Groceries": ["grocery", "grocer", "supermarket", "market", "produce", "trader joe", "whole foods", "kroger",
                  "publix", "safeway", "aldi", "wegman", "food lion", "milk", "eggs", "bread", "bananas"],
    "Transportation": ["uber", "lyft", "taxi", "parking", "toll", "transit", "fuel", "gas", "gasoline", "unleaded",
                       "shell", "chevron", "exxon", "bp", "citgo", "marathon"],
    "Travel": ["airline", "air lines", "airways", "airport", "hotel", "motel", "inn", "resort", "airbnb", "amtrak",
               "delta", "united", "southwest"],
    "Shopping": ["office", "staples", "electronics", "hardware", "best buy", "target", "walmart", "amazon", "costco",
                 "ikea", "home depot", "lowe", "clothing", "apparel", "printer", "toner", "cable"],
    "Health": ["pharmacy", "drug", "cvs", "walgreens", "rite aid", "clinic", "dental", "doctor", "hospital",
               "vitamin", "ibuprofen"],
    "Entertainment": ["cinema", "theater", "theatre", "movie", "bowling", "arcade", "concert", "museum", "ticketmaster",
                      "amc", "regal"],
}

# \b stops "ink" matching "drink" and "gas" matching "vegas"; the optional s catches simple plurals
PATTERNS = {
    category: [re.compile(rf"\b{re.escape(word)}s?\b") for word in words] for category, words in KEYWORDS.items()
}


def _clean(text: str) -> str:
    return " ".join(re.sub(r"['’]", "", text.lower()).replace("-", " ").split())


def classify(merchant: str | None, item_names: list[str]) -> str:
    merchant_text = _clean(merchant or "")
    item_text = _clean(" ".join(item_names))

    def score(category: str) -> int:
        return sum(
            MERCHANT_WEIGHT * bool(pattern.search(merchant_text)) + bool(pattern.search(item_text))
            for pattern in PATTERNS[category]
        )

    best = max(PATTERNS, key=score)
    return best if score(best) > 0 else "Other"


def remembered_category(db: Session, receipt: Receipt) -> str | None:
    """The category this user last chose by hand for this merchant, if they've ever chosen one."""
    if receipt.merchant_key is None:
        return None
    stmt = (
        select(Receipt.category)
        .where(
            Receipt.user_id == receipt.user_id,
            Receipt.merchant_key == receipt.merchant_key,
            Receipt.category_source == "user",
            Receipt.category.is_not(None),
            Receipt.id != receipt.id,
        )
        .order_by(Receipt.created_at.desc())
        .limit(1)
    )
    return db.scalar(stmt)
