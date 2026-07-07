"""FastAPI application factory for the assessment platform."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api import auth
from .db import database as db

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


def create_app() -> FastAPI:
    app = FastAPI(title="Assessment Platform", version="0.1.0")

    db.init_db()
    db.seed_default_users()

    app.include_router(auth.router)

    @app.get("/api/health")
    def health():
        return {"ok": True}

    # Serve the built SPA when present (production single-process mode);
    # in dev, Vite proxies /api to this server instead.
    if FRONTEND_DIST.exists():
        app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            candidate = FRONTEND_DIST / path
            if path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(FRONTEND_DIST / "index.html")

    return app


app = create_app()
