import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from ..db import SessionLocal
from ..models import LineItem, Receipt
from .classifier import classify, remembered_category
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


def _apply_result(db: Session, receipt: Receipt, data) -> None:
    """Fill the receipt from the OCR result, or flag it for review if the OCR failed (data is None)."""
    if data is None:
        receipt.status = "review"
        receipt.review_reason = "Couldn’t read this receipt, please fill it in"
        return
    receipt.merchant = data.merchant or receipt.merchant
    receipt.date = data.date or receipt.date
    receipt.subtotal = data.subtotal
    receipt.discount = data.discount
    receipt.tax = data.tax
    receipt.total = data.total
    receipt.items = [LineItem(name=i.name, qty=i.qty, total=i.total) for i in data.items]
    receipt.category = remembered_category(db, receipt) or classify(
        receipt.merchant, [i.name for i in data.items]
    )
    receipt.status, receipt.review_reason = check_receipt(receipt)


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
            data = None

        # Reading can take a while; the user may have deleted the receipt in the meantime
        if db.scalar(select(Receipt.id).where(Receipt.id == receipt_id)) is None:
            logger.info("Receipt %s was deleted while processing; dropping the result", receipt_id)
            return
        try:
            _apply_result(db, receipt, data)
            db.commit()
        except StaleDataError:  # deleted in the moment between the check and the save
            db.rollback()
            logger.info("Receipt %s was deleted while processing; dropping the result", receipt_id)
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
