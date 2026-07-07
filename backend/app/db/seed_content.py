"""Seed the content_items table from the content/ corpus (idempotent).

Rubrics keep the version stamped inside their JSON; scenarios and FR prompts
are seeded at version '1.0'. Seeding never overwrites an existing
(kind, content_id, version) row, so local edits made through the app survive
re-seeding.
"""

import json
from pathlib import Path

from ..services import loaders
from . import database as db

CONTENT_DIR = Path(__file__).resolve().parents[3] / "content"


def _seed_item(kind: str, content_id: str, version: str, payload: dict, verbose: bool):
    if db.get_content(kind, content_id, version):
        return False
    db.upsert_content(kind, content_id, version, payload, created_by="seed")
    if verbose:
        print(f"[seed] {kind}: {content_id} v{version}")
    return True


def seed(verbose: bool = True) -> int:
    db.init_db()
    n = 0
    for path in sorted((CONTENT_DIR / "rubrics").glob("*.json")):
        payload = json.loads(path.read_text())
        n += _seed_item("rubric", payload.get("rubricId", path.stem),
                        payload.get("version", "1.0"), payload, verbose)
    for path in sorted((CONTENT_DIR / "scenarios").glob("*.json")):
        payload = loaders.load_scenario(path)
        n += _seed_item("scenario", payload["id"], "1.0", payload, verbose)
    for path in sorted((CONTENT_DIR / "prompts").glob("*.json")):
        payload = loaders.load_prompt(path)
        n += _seed_item("fr_prompt", payload["id"], "1.0", payload, verbose)
    if verbose and n == 0:
        print("[seed] Content already present; skipped.")
    return n
