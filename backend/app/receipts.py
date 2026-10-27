import datetime as dt
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import get_current_user
from .db import get_db
from .models import LineItem, Receipt, User
from .pipeline import process_receipt
from .schemas import ReceiptOut, ReceiptUpdate

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "application/pdf": ".pdf"}
MAX_BYTES = 10 * 1024 * 1024

router = APIRouter(prefix="/api/receipts")


def get_owned_receipt(receipt_id: int, user: User, db: Session) -> Receipt:
    receipt = db.get(Receipt, receipt_id)
    # 404 rather than 403 so other users' ids aren't confirmed to exist
    if receipt is None or receipt.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    return receipt


@router.get("", response_model=list[ReceiptOut])
def list_receipts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = (
        select(Receipt)
        .where(Receipt.user_id == user.id)
        .order_by(Receipt.date.desc(), Receipt.created_at.desc())
    )
    return db.scalars(stmt).all()


@router.post("", response_model=ReceiptOut, status_code=status.HTTP_201_CREATED)
def upload_receipt(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ext = ALLOWED_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a JPG, PNG or PDF")
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File is larger than 10 MB")

    # The stored name is random; the uploaded filename is never used as a path
    path = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    path.write_bytes(data)

    # Placeholder merchant and date so the row has something to show while it's processing
    receipt = Receipt(user_id=user.id, file_path=str(path), merchant=file.filename, date=dt.date.today())
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    background_tasks.add_task(process_receipt, receipt.id)
    return receipt


@router.get("/{receipt_id}", response_model=ReceiptOut)
def get_receipt(receipt_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned_receipt(receipt_id, user, db)


@router.get("/{receipt_id}/image")
def get_receipt_image(receipt_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return FileResponse(get_owned_receipt(receipt_id, user, db).file_path)


@router.patch("/{receipt_id}", response_model=ReceiptOut)
def update_receipt(
    receipt_id: int,
    body: ReceiptUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    receipt = get_owned_receipt(receipt_id, user, db)
    if receipt.status == "processing":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Receipt is still being read")
    receipt.merchant = body.merchant.strip()
    receipt.date = body.date
    receipt.category = body.category
    receipt.subtotal = body.subtotal
    receipt.tax = body.tax
    receipt.total = body.total
    receipt.items = [LineItem(**item.model_dump()) for item in body.items]
    # Someone has checked it by hand, so it no longer needs review
    receipt.status = "done"
    receipt.review_reason = None
    db.commit()
    db.refresh(receipt)
    return receipt


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_receipt(receipt_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    receipt = get_owned_receipt(receipt_id, user, db)
    Path(receipt.file_path).unlink(missing_ok=True)
    db.delete(receipt)
    db.commit()
