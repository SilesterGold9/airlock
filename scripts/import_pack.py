#!/usr/bin/env python3
"""
Imports a problem pack (packs/<name>/) into the CP Trainer SQLite database.

Usage:
    python3 scripts/import_pack.py <pack_dir> /path/to/airlock.sqlite

Pack layout (see packs/week-1-implementation/):
    pack.json          -- {"pack_name": ..., "techniques": [{id, name}], "problem_files": [...]}
    <problem>.json     -- same shape as sample-problems/*.json (Problem struct)

Behavior:
  - Techniques are upserted gently: if a technique id already exists locally,
    the LOCAL row is kept untouched (status/notes preserved). Otherwise the
    technique is inserted with status NotStarted, a fresh timestamp, NULL notes.
  - Problems are INSERT OR REPLACE + DELETE+reinsert of their test_cases,
    exactly like scripts/seed_problems.py.
"""
import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    pack_dir = Path(sys.argv[1])
    db_path = sys.argv[2]
    pack_path = pack_dir / "pack.json"
    if not pack_path.is_file():
        print(f"error: no pack.json in {pack_dir}")
        sys.exit(1)

    pack = json.loads(pack_path.read_text())
    manifest_ids = {t["id"] for t in pack.get("techniques", [])}

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    inserted = 0
    kept = 0
    for t in pack.get("techniques", []):
        row = cur.execute("SELECT id FROM techniques WHERE id = ?", (t["id"],)).fetchone()
        if row:
            kept += 1
            print(f"Kept local technique: {t['id']} (status/notes untouched)")
        else:
            cur.execute(
                """INSERT INTO techniques (id, name, status, status_updated_at, notes_md)
                   VALUES (?, ?, 'NotStarted', ?, NULL)""",
                (t["id"], t["name"], utcnow_iso()),
            )
            inserted += 1
            print(f"Inserted technique: {t['id']} ({t['name']})")

    problem_count = 0
    test_count = 0
    for fname in pack.get("problem_files", []):
        data = json.loads((pack_dir / fname).read_text())
        problem_id = data["id"] or str(uuid.uuid4())

        tech = data.get("primary_technique_id")
        if tech and tech not in manifest_ids:
            print(f"warning: {fname} links primary_technique_id={tech!r} not listed in pack.json")

        cur.execute(
            """INSERT OR REPLACE INTO problems
               (id, title, statement_md, tags, difficulty, time_limit_ms,
                memory_limit_mb, source, brute_force_src, brute_force_lang, notes_md, primary_technique_id, hints)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                problem_id,
                data["title"],
                data["statement_md"],
                json.dumps(data["tags"]),
                data["difficulty"],
                data["time_limit_ms"],
                data["memory_limit_mb"],
                data["source"],
                data.get("brute_force_src"),
                data.get("brute_force_lang"),
                data.get("notes_md"),
                data.get("primary_technique_id"),
                json.dumps(data.get("hints") or []),
            ),
        )
        cur.execute("DELETE FROM test_cases WHERE problem_id = ?", (problem_id,))
        n_tests = 0
        for t in data["tests"]:
            test_id = t["id"] or str(uuid.uuid4())
            cur.execute(
                "INSERT INTO test_cases (id, problem_id, input, expected_output) VALUES (?, ?, ?, ?)",
                (test_id, problem_id, t["input"], t["expected_output"]),
            )
            n_tests += 1
        problem_count += 1
        test_count += n_tests
        print(f"Imported: {data['title']} ({n_tests} tests)")

    conn.commit()
    conn.close()
    print(f"Done: {inserted} technique(s) inserted, {kept} kept, "
          f"{problem_count} problem(s) with {test_count} test(s) from '{pack.get('pack_name')}'.")


if __name__ == "__main__":
    main()
