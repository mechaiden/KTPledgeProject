CATEGORIES = ["Food", "Office", "Travel", "Other"]

KEYWORDS = {
    "Food": ["restaurant", "cafe", "coffee", "pizza", "grill", "kitchen", "bakery", "grocery", "market",
             "chipotle", "panera", "starbucks", "trader joe", "burrito", "sandwich"],
    "Office": ["office", "staples", "paper", "ink", "printer", "pens", "tape", "labels", "toner"],
    "Travel": ["uber", "lyft", "airline", "air lines", "hotel", "parking", "shell", "chevron", "fuel", "gas"],
}


def classify(merchant: str | None, item_names: list[str]) -> str:
    text = " ".join([merchant or "", *item_names]).lower()
    scores = {category: sum(word in text for word in words) for category, words in KEYWORDS.items()}
    best = max(scores, key=lambda category: scores[category])
    return best if scores[best] > 0 else "Other"
