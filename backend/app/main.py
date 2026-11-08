import threading
from contextlib import asynccontextmanager

from .pipeline.parser import warm_up

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (registers tables on Base.metadata)
from .db import Base, engine
from .pipeline import fail_interrupted_receipts
from .insights_routes import router as insights_router
from .receipts import router as receipts_router
from .routes import router

Base.metadata.create_all(bind=engine)
fail_interrupted_receipts()

async def lifespan(app):
    threading.Thread(target=warm_up, daemon=True).start()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(receipts_router)
app.include_router(insights_router)
