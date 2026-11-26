"""FastAPI application factory for Agentic-Recovery."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from recovery.api import router
from recovery.storage import initialize, make_engine


def create_app(engine=None) -> FastAPI:
    if engine is None:
        engine = make_engine()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        initialize(engine)
        yield

    app = FastAPI(
        title="Agentic-Recovery",
        description="Receiver-side UPI payment observation system",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.state.engine = engine
    app.include_router(router)
    return app
