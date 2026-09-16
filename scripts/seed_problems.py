#!/usr/bin/env python3
"""
Seeds sample-problems/*.json into the CP Trainer SQLite database.

Usage:
    python3 scripts/seed_problems.py /path/to/cp-trainer.sqlite

On Linux, the Tauri app data dir is typically:
    ~/.local/share/com.silvestre.cptrainer/cp-trainer.sqlite
(run the app once first so it creates the schema, then run this script)
"""
import json
import sqlite3
import sys
import uuid
from pathlib import Path

def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    db_path = sys.argv[1]
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    problems_dir = Path(__file__).parent.parent / "sample-problems"
    for path in problems_dir.glob("*.json"):
        data = json.loads(path.read_text())
        problem_id = data["id"] or str(uuid.uuid4())

        cur.execute(
            """INSERT OR REPLACE INTO problems
               (id, title, statement_md, tags, difficulty, time_limit_ms,
                memory_limit_mb, source, brute_force_src, brute_force_lang)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
            ),
        )
        cur.execute("DELETE FROM test_cases WHERE problem_id = ?", (problem_id,))
        for t in data["tests"]:
            test_id = t["id"] or str(uuid.uuid4())
            cur.execute(
                "INSERT INTO test_cases (id, problem_id, input, expected_output) VALUES (?, ?, ?, ?)",
                (test_id, problem_id, t["input"], t["expected_output"]),
            )
        print(f"Seeded: {data['title']}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
