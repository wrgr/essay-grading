"""Export schema v3 — rewritten from the V5 test for the consolidated platform.

Guards the same invariants: every canonical evaluation field exists as a column,
the idempotent widening migration picks up new fields on existing databases,
schema versions are traceable per row, and every export column is documented in
the data dictionary.
"""

import sqlite3
import tempfile
import unittest
from pathlib import Path

from app.api.export import EXPORT_FIELDS
from app.db import database

REPO_ROOT = Path(__file__).resolve().parents[2]


class EvaluationSchemaTests(unittest.TestCase):
    """Each test runs against its own throwaway database (the V5 pattern), so
    destructive schema simulations never leak into the shared test DB."""

    def setUp(self):
        self._orig_db_file = database.DB_FILE
        database.DB_FILE = Path(tempfile.mktemp(suffix=".db"))

    def tearDown(self):
        database.DB_FILE = self._orig_db_file

    def _evaluation_columns(self):
        with sqlite3.connect(str(database.DB_FILE)) as conn:
            return {row[1] for row in conn.execute("PRAGMA table_info(evaluations)").fetchall()}

    def test_init_db_creates_all_canonical_evaluation_fields(self):
        database.init_db()
        columns = self._evaluation_columns()
        for field in database.EVALUATION_FIELDS:
            self.assertIn(field, columns)

    def test_init_db_widens_existing_evaluations_table(self):
        """The V5 idempotent ALTER-TABLE migration must carry forward: a database
        created before a field existed gains it on the next init_db()."""
        database.init_db()
        probe_field = "closing_nudge_used"
        with sqlite3.connect(str(database.DB_FILE)) as conn:
            # simulate an old database missing one canonical column
            cols = [r[1] for r in conn.execute("PRAGMA table_info(evaluations)")]
            self.assertIn(probe_field, cols)
            remaining = [c for c in cols if c != probe_field]
            conn.execute("ALTER TABLE evaluations RENAME TO evaluations_old")
            conn.execute(
                "CREATE TABLE evaluations (" +
                ", ".join(f"{c} TEXT" if c not in ("id",) else "id INTEGER PRIMARY KEY AUTOINCREMENT"
                          for c in remaining) + ")")
            conn.execute("DROP TABLE evaluations_old")
            conn.commit()

        database.init_db()
        self.assertIn(probe_field, self._evaluation_columns())

    def test_rows_stamp_schema_version(self):
        database.init_db()
        aid = database.create_assessment(username="emma", mode="free_response",
                                         name="Schema stamp test")
        database.upsert_evaluation(aid, {"task_title": "Schema stamp test",
                                         "report_type": "free_response"})
        row = database.get_evaluations(aid)[0]
        self.assertEqual(row["export_schema_version"], database.EXPORT_SCHEMA_VERSION)
        database.delete_assessment(aid)

    def test_upsert_is_idempotent_per_task(self):
        database.init_db()
        aid = database.create_assessment(username="emma", mode="free_response",
                                         name="Idempotency test")
        for _ in range(3):
            database.upsert_evaluation(aid, {"task_title": "T", "report_type": "free_response"})
        self.assertEqual(len(database.get_evaluations(aid)), 1)
        database.delete_assessment(aid)


class ExportDictionaryTests(unittest.TestCase):
    DOC = (REPO_ROOT / "docs" / "research_export_data_dictionary.md").read_text(encoding="utf-8")

    def test_schema_version_is_3(self):
        self.assertEqual(database.EXPORT_SCHEMA_VERSION, "3")
        self.assertIn("v3", self.DOC)

    def test_v2_process_fields_still_documented(self):
        for field in ("`closing_nudge_used`", "`process_caution`", "`export_schema_version`"):
            self.assertIn(field, self.DOC)

    def test_every_export_column_is_documented(self):
        for field in EXPORT_FIELDS:
            self.assertIn(f"`{field}`", self.DOC,
                          f"export column {field} missing from the data dictionary")

    def test_export_fields_cover_all_evaluation_fields(self):
        for field in database.EVALUATION_FIELDS:
            self.assertIn(field, EXPORT_FIELDS)


if __name__ == "__main__":
    unittest.main()
