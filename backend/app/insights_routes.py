import datetime as dt

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import insights
from .auth import get_current_user
from .db import get_db
from .models import Receipt, User
from .schemas import CategorySpend, MerchantStat, ReceiptSizeStat, SavingsStat, TrendMonth, WeekdayStat

router = APIRouter(prefix="/api/insights")

# "YYYY-MM". The frontend sends the month so "this month" follows the user's clock, not the server's
MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


def counted_receipts(db: Session, user: User, start: dt.date | None = None, end: dt.date | None = None):
    """The user's receipts that belong in stats, optionally limited to start <= date < end."""
    stmt = select(Receipt).where(
        Receipt.user_id == user.id,
        # A receipt being processed still has placeholder data: the filename as merchant and today as date
        Receipt.status != "processing",
        Receipt.date.is_not(None),
        Receipt.total.is_not(None),
    )
    if start is not None:
        stmt = stmt.where(Receipt.date >= start)
    if end is not None:
        stmt = stmt.where(Receipt.date < end)
    return db.scalars(stmt).all()


def optional_month_bounds(month: str | None) -> tuple[dt.date | None, dt.date | None]:
    return insights.month_bounds(month) if month else (None, None)


@router.get("/categories", response_model=list[CategorySpend])
def categories(
    month: str = Query(pattern=MONTH_PATTERN),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start, _ = insights.month_bounds(insights.previous_month(month))
    _, end = insights.month_bounds(month)
    return insights.spend_by_category(counted_receipts(db, user, start, end), month)


@router.get("/trend", response_model=list[TrendMonth])
def trend(
    month: str = Query(pattern=MONTH_PATTERN),
    months: int = Query(6, ge=1, le=24),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start, _ = insights.month_bounds(insights.last_n_months(month, months)[0])
    _, end = insights.month_bounds(month)
    return insights.monthly_trend(counted_receipts(db, user, start, end), month, months)


@router.get("/merchants", response_model=list[MerchantStat])
def merchants(
    month: str | None = Query(None, pattern=MONTH_PATTERN),
    limit: int = Query(10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return insights.top_merchants(counted_receipts(db, user, *optional_month_bounds(month)), limit)


@router.get("/weekdays", response_model=list[WeekdayStat])
def weekdays(
    month: str | None = Query(None, pattern=MONTH_PATTERN),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return insights.weekday_pattern(counted_receipts(db, user, *optional_month_bounds(month)))


@router.get("/receipt-size", response_model=list[ReceiptSizeStat])
def receipt_size(
    month: str | None = Query(None, pattern=MONTH_PATTERN),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return insights.receipt_size_by_category(counted_receipts(db, user, *optional_month_bounds(month)))


@router.get("/savings", response_model=SavingsStat)
def savings(
    year: int = Query(ge=2000, le=2100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    receipts = counted_receipts(db, user, dt.date(year, 1, 1), dt.date(year + 1, 1, 1))
    return insights.savings(receipts)
