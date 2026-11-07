import datetime as dt

from pydantic import BaseModel, ConfigDict, computed_field, field_validator
from pydantic.alias_generators import to_camel

from .pipeline.classifier import CATEGORIES


class CamelModel(BaseModel):
    """Python uses snake_case, the frontend uses camelCase (review_reason <-> reviewReason)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class LineItemSchema(CamelModel):
    name: str
    qty: int | None = None
    total: float | None = None


class ReceiptOut(CamelModel):
    id: int
    status: str
    review_reason: str | None
    date: dt.date | None
    merchant: str | None
    category: str | None
    subtotal: float | None
    discount: float | None
    tax: float | None
    total: float | None
    items: list[LineItemSchema]

    @computed_field(alias="imageUrl")
    @property
    def image_url(self) -> str:
        return f"/api/receipts/{self.id}/image"


class ReceiptUpdate(CamelModel):
    merchant: str
    date: dt.date
    category: str | None = None
    subtotal: float | None = None
    discount: float | None = None
    tax: float | None = None
    total: float
    items: list[LineItemSchema] = []

    @field_validator("category")
    @classmethod
    def category_must_be_known(cls, category: str | None) -> str | None:
        if category is not None and category not in CATEGORIES:
            raise ValueError(f"Unknown category: {category}")
        return category


# --- Insights (spending stats) ---


class CategorySpend(CamelModel):
    category: str
    total: float
    prev_total: float
    change: float


class TrendMonth(CamelModel):
    month: str
    total: float
    by_category: dict[str, float]


class MerchantStat(CamelModel):
    merchant_key: str
    name: str | None
    visits: int
    total: float
    avg_per_visit: float


class WeekdayStat(CamelModel):
    weekday: str
    total: float
    visits: int


class ReceiptSizeStat(CamelModel):
    category: str
    count: int
    average: float
    median: float


class SavingsStat(CamelModel):
    discount_total: float
    tax_total: float
    receipt_count: int
