"""A receipt deleted while the OCR is still reading it must not crash the background task."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.pipeline as pipeline
from app.db import Base
from app.models import Receipt, User
from app.pipeline.extractor import ExtractedReceipt


@pytest.fixture
def db_factory(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    monkeypatch.setattr(pipeline, "SessionLocal", factory)
    return factory


def make_receipt(factory) -> int:
    with factory() as db:
        user = User(email="t@t.dev", password_hash="x")
        db.add(user)
        db.flush()
        receipt = Receipt(user_id=user.id, file_path="/nonexistent.png", status="processing")
        db.add(receipt)
        db.commit()
        return receipt.id


def delete_receipt(factory, receipt_id: int) -> None:
    with factory() as db:
        db.delete(db.get(Receipt, receipt_id))
        db.commit()


@pytest.mark.parametrize("ocr_fails", [False, True])
def test_receipt_deleted_mid_processing(db_factory, monkeypatch, ocr_fails):
    receipt_id = make_receipt(db_factory)

    def parse_while_user_deletes(_path):
        delete_receipt(db_factory, receipt_id)
        if ocr_fails:
            raise RuntimeError("file vanished")
        return "parsed"

    monkeypatch.setattr(pipeline, "parse_document", parse_while_user_deletes)
    monkeypatch.setattr(pipeline, "extract_fields", lambda _doc: ExtractedReceipt(merchant="Shop", total=4.0))

    pipeline.process_receipt(receipt_id)  # must not raise

    with db_factory() as db:
        assert db.get(Receipt, receipt_id) is None


def test_receipt_still_filled_in_when_not_deleted(db_factory, monkeypatch):
    receipt_id = make_receipt(db_factory)
    monkeypatch.setattr(pipeline, "parse_document", lambda _path: "parsed")
    monkeypatch.setattr(pipeline, "extract_fields", lambda _doc: ExtractedReceipt(merchant="Shop", total=4.0))

    pipeline.process_receipt(receipt_id)

    with db_factory() as db:
        receipt = db.get(Receipt, receipt_id)
        assert (receipt.merchant, receipt.total, receipt.status) == ("Shop", 4.0, "done")
