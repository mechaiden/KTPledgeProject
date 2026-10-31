import datetime as dt

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Base
from app.merchants import normalize_merchant
from app.models import Receipt, User
from app.pipeline.classifier import classify, remembered_category
from app.pipeline.extractor import extract_fields
from app.schemas import ReceiptUpdate


@pytest.mark.parametrize(
    "printed, expected",
    [
        ("CHIPOTLE #1234", "chipotle"),
        ("Chipotle", "chipotle"),
        ("Chipotle Store 88", "chipotle"),
        ("Trader Joe's", "trader joes"),
        ("TRADER JOE’S #552", "trader joes"),
        ("Shell 57442", "shell"),
        ("Ironwood Hardware, Inc.", "ironwood hardware"),
        ("WAL-MART SUPERCENTER", "walmart"),
        ("WM SUPERCENTER #1021", "walmart"),
        ("AMZN Mktp US", "amazon"),
        ("Targeted Pest Control", "targeted pest control"),
        ("7-Eleven", "7 eleven"),
        ("", None),
        (None, None),
    ],
)
def test_normalize_merchant(printed, expected):
    assert normalize_merchant(printed) == expected


@pytest.mark.parametrize(
    "merchant, items, expected",
    [
        ("Chipotle", ["Chicken Burrito Bowl"], "Dining"),
        ("Greenbasket Grocers", ["Milk", "Eggs"], "Groceries"),
        ("Riverbend Fuel Stop", [], "Transportation"),
        ("Voltline Electronics", ["Phone Case"], "Shopping"),
        ("Ironwood Hardware", [], "Shopping"),
        ("Maple Street Office Supply", ["Printer Paper 500ct"], "Shopping"),
        ("CVS Pharmacy", [], "Health"),
        ("Delta Air Lines", [], "Travel"),
        ("AMC Theatres", [], "Entertainment"),
        ("Unknown Place", ["Thing"], "Other"),
    ],
)
def test_classify(merchant, items, expected):
    assert classify(merchant, items) == expected


def test_classify_only_matches_whole_words():
    assert classify("Las Vegas Souvenirs", []) == "Other"  # "gas"
    assert classify("Unknown Place", ["Iced Tea Drink"]) == "Other"  # "ink"
    assert classify(None, ["Business Expenses Folder"]) == "Other"  # "pens"


def test_merchant_outweighs_a_stray_item_word():
    # Items can point somewhere else, but three matching words aren't needed to beat the store itself
    assert classify("Shell", ["Coffee"]) == "Transportation"


def test_merchant_key_follows_merchant():
    receipt = Receipt(user_id=1, file_path="x", merchant="CHIPOTLE #1234")
    assert receipt.merchant_key == "chipotle"
    receipt.merchant = "Panera Bread"
    assert receipt.merchant_key == "panera bread"


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add_all([User(id=1, email="a@test.com", password_hash="x"), User(id=2, email="b@test.com", password_hash="x")])
        session.commit()
        yield session


def make_receipt(db, user_id, merchant, category, source):
    receipt = Receipt(
        user_id=user_id, file_path="x", merchant=merchant, category=category, category_source=source,
        date=dt.date(2026, 10, 1),
    )
    db.add(receipt)
    db.commit()
    return receipt


def test_remembers_a_users_correction_across_spellings(db):
    make_receipt(db, 1, "JOE'S DINER #3", "Groceries", "user")
    new = make_receipt(db, 1, "Joe's Diner", None, "auto")
    assert remembered_category(db, new) == "Groceries"


def test_does_not_remember_the_classifiers_own_guesses(db):
    make_receipt(db, 1, "Joe's Diner", "Dining", "auto")
    new = make_receipt(db, 1, "Joe's Diner", None, "auto")
    assert remembered_category(db, new) is None


def test_corrections_are_per_user(db):
    make_receipt(db, 1, "Joe's Diner", "Groceries", "user")
    new = make_receipt(db, 2, "Joe's Diner", None, "auto")
    assert remembered_category(db, new) is None


def test_discounts_are_stored_positive_and_added_up():
    r = extract_fields("Store\nThing 10.00\nCOUPON -1.50\nMember Savings 2.00\nSUBTOTAL 6.50\nTOTAL 6.50")
    assert r.discount == 3.50
    assert r.total == 6.50


def test_all_caps_merchant_with_apostrophe():
    assert extract_fields("JOE'S SHACK\nTOTAL 9.00").merchant == "Joe's Shack"


def test_rejects_categories_outside_the_list():
    base = {"merchant": "x", "date": "2026-10-01", "total": 1.0}
    assert ReceiptUpdate(**base, category="Dining").category == "Dining"
    with pytest.raises(ValueError):
        ReceiptUpdate(**base, category="Food")
