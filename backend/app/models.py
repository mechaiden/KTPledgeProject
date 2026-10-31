import datetime as dt

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from .db import Base
from .merchants import normalize_merchant


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    file_path: Mapped[str] = mapped_column(String(500))
    # 'processing' | 'review' | 'done'
    status: Mapped[str] = mapped_column(String(20), default="processing")
    review_reason: Mapped[str | None] = mapped_column(String(255))

    date: Mapped[dt.date | None] = mapped_column(Date)
    merchant: Mapped[str | None] = mapped_column(String(255))
    # Groups spellings of the same store; kept up to date by the validator below
    merchant_key: Mapped[str | None] = mapped_column(String(255))
    category: Mapped[str | None] = mapped_column(String(50))
    # 'auto' | 'user'
    category_source: Mapped[str] = mapped_column(String(20), default="auto")
    subtotal: Mapped[float | None] = mapped_column(Float)
    discount: Mapped[float | None] = mapped_column(Float)
    tax: Mapped[float | None] = mapped_column(Float)
    total: Mapped[float | None] = mapped_column(Float)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    items: Mapped[list["LineItem"]] = relationship(
        back_populates="receipt", cascade="all, delete-orphan", order_by="LineItem.id"
    )

    @validates("merchant")
    def _update_merchant_key(self, _key: str, merchant: str | None) -> str | None:
        self.merchant_key = normalize_merchant(merchant)
        return merchant


class LineItem(Base):
    __tablename__ = "line_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    receipt_id: Mapped[int] = mapped_column(ForeignKey("receipts.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    qty: Mapped[int | None] = mapped_column(Integer)
    # Nullable because the OCR sometimes misses a line total
    total: Mapped[float | None] = mapped_column(Float)

    receipt: Mapped[Receipt] = relationship(back_populates="items")
