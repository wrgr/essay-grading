import os
import sys
import tempfile
from pathlib import Path

import pytest

# Make `app` importable when pytest runs from backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Every test session gets a throwaway database, set before app.db.database
# resolves its module-level paths.
_tmpdir = tempfile.mkdtemp(prefix="ap-test-")
os.environ["ASSESSMENT_DATA_DIR"] = _tmpdir
os.environ["ASSESSMENT_DB_PATH"] = str(Path(_tmpdir) / "test.db")

# Tests must never depend on ambient provider credentials — force the
# keyword-fallback path unless a test explicitly monkeypatches the bridge.
for _var in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY",
             "GROQ_API_KEY", "MISTRAL_API_KEY", "GITHUB_MODELS_TOKEN"):
    os.environ.pop(_var, None)
os.environ["OLLAMA_BASE_URL"] = "http://127.0.0.1:9"  # unroutable — Ollama absent


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def admin_client(client):
    resp = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
        headers={"X-Requested-With": "fetch"},
    )
    assert resp.status_code == 200, resp.text
    return client


@pytest.fixture()
def student_client(client):
    resp = client.post(
        "/api/auth/login",
        json={"username": "emma", "password": "Learn@2024"},
        headers={"X-Requested-With": "fetch"},
    )
    assert resp.status_code == 200, resp.text
    return client
