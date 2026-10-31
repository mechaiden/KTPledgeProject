"""One-time upgrade for databases created before merchant_key, discount and category_source existed.

Run from backend/ with the server stopped:  PYTHONPATH=. venv/bin/python scripts/upgrade_db.py
Backs up a SQLite database first, and does nothing if the database is already upgraded.
"""

import datetime as dt
import shutil
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import inspect, text

from app.db import SessionLocal, engine
from app.merchants import normalize_merchant
from app.models import Receipt
from app.pipeline.classifier import CATEGORIES, classify

# Used when the keywords can't place a receipt that had one of the old categories
OLD_CATEGORY_FALLBACKS = {"Food": "Dining", "Office": "Shopping", "Travel": "Travel"}


def main() -> None:
    if "merchant_key" in {column["name"] for column in inspect(engine).get_columns("receipts")}:
        print("Already upgraded, nothing to do.")
        return

    if engine.url.get_backend_name() == "sqlite":
        db_path = Path(engine.url.database)
        backup = db_path.with_name(f"{db_path.stem}.backup-{dt.datetime.now():%Y%m%d-%H%M%S}.db")
        shutil.copy2(db_path, backup)
        print(f"Backed up to {backup}")

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE receipts ADD COLUMN merchant_key VARCHAR(255)"))
        conn.execute(text("ALTER TABLE receipts ADD COLUMN discount FLOAT"))
        conn.execute(text("ALTER TABLE receipts ADD COLUMN category_source VARCHAR(20) NOT NULL DEFAULT 'auto'"))

    db = SessionLocal()
    try:
        for receipt in db.query(Receipt):
            receipt.merchant_key = normalize_merchant(receipt.merchant)
            old = receipt.category
            if old is not None:
                new = classify(receipt.merchant, [item.name for item in receipt.items])
                if new == "Other":
                    new = OLD_CATEGORY_FALLBACKS.get(old, "Other")
                assert new in CATEGORIES
                receipt.category = new
                print(f"#{receipt.id} {receipt.merchant}: {old} -> {new}")
        db.commit()
    finally:
        db.close()
    print("Done.")


if __name__ == "__main__":
    main()
