import re

# Different names the same chain prints on receipts, matched against the start of the cleaned name
ALIASES = {
    "amazon": "amazon",
    "amzn": "amazon",
    "mcdonalds": "mcdonalds",
    "starbucks": "starbucks",
    "target": "target",
    "wal mart": "walmart",
    "walmart": "walmart",
    "wm supercenter": "walmart",
}


def normalize_merchant(name: str | None) -> str | None:
    """Reduce a printed merchant name to a key, so "CHIPOTLE #1234" and "Chipotle" group together."""
    if not name or not name.strip():
        return None
    key = re.sub(r"['’]", "", name.lower())
    # Store numbers: "#1234", "No. 12", "Store 88"
    key = re.sub(r"#\s*\d+|\b(?:no|store|unit)\b\.?\s*\d+", " ", key)
    key = re.sub(r"[^a-z0-9]+", " ", key)
    key = re.sub(r"\b(?:inc|llc|ltd|co|corp|corporation|company)\b", " ", key)
    key = re.sub(r"\s\d+\s*$", " ", key)  # a bare number at the end is another store number
    key = " ".join(key.split())
    for prefix, canonical in ALIASES.items():
        if key == prefix or key.startswith(f"{prefix} "):
            return canonical
    return key or None
