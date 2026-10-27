import logging
from pathlib import Path

from ..db import SessionLocal
from ..models import LineItem, Receipt
from .classifier import classify
from .extractor import extract_fields
from .parser import parse_document

logger = logging.getLogger(__name__)


def check_receipt(receipt: Receipt) -> tuple[str, str | None]:
    """Decide whether a parsed receipt can be trusted. Returns (status, review_reason)."""
    if receipt.total is None:
        return "review", "Couldn’t find the total"
    missing = sum(item.total is None for item in receipt.items)
    if missing:
        return "review", f"Couldn’t read the price of {missing} item{'s' if missing > 1 else ''}"
    if receipt.items and receipt.subtotal is not None:
        items_sum = sum(item.total for item in receipt.items if item.total is not None)
        if abs(items_sum - receipt.subtotal) > 0.005:
            return "review", "Items don’t add up to the subtotal"
    return "done", None


def process_receipt(receipt_id: int) -> None:
    # Runs after the upload request has returned, so it needs its own session
    db = SessionLocal()
    try:
        receipt = db.get(Receipt, receipt_id)
        if receipt is None:  # deleted before processing started
            return
        try:
            data = extract_fields(parse_document(Path(receipt.file_path)))
        except Exception:
            logger.exception("Failed to read receipt %s", receipt_id)
            receipt.status = "review"
            receipt.review_reason = "Couldn’t read this receipt, please fill it in"
            db.commit()
            return

        receipt.merchant = data.merchant or receipt.merchant
        receipt.date = data.date or receipt.date
        receipt.subtotal = data.subtotal
        receipt.tax = data.tax
        receipt.total = data.total
        receipt.items = [LineItem(name=i.name, qty=i.qty, total=i.total) for i in data.items]
        receipt.category = classify(receipt.merchant, [i.name for i in data.items])
        receipt.status, receipt.review_reason = check_receipt(receipt)
        db.commit()
    finally:
        db.close()


def fail_interrupted_receipts() -> None:
    """Receipts left 'processing' by a server restart will never finish, so flag them for review."""
    db = SessionLocal()
    try:
        for receipt in db.query(Receipt).filter(Receipt.status == "processing"):
            receipt.status = "review"
            receipt.review_reason = "Processing was interrupted, please fill it in"
        db.commit()
    finally:
        db.close()
