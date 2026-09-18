#!/usr/bin/env python3
"""
Exports the local SQLite database into a shareable problem pack directory.

Usage:
    python3 scripts/export_pack.py <db_path> <out_dir> --name "My Pack"

Privacy: the export follows an EXPLICIT allowlist. Only these fields leave
the machine:

  Problem allowlist: id, title, statement_md, tags, difficulty,
    time_limit_ms, memory_limit_mb, source, tests (id, input,
    expected_output), brute_force_src, brute_force_lang, hints,
    primary_technique_id
  Technique allowlist: id, name

NEVER exported: problem notes_md, submissions (source code / verdicts),
contests, reimplementation schedule, problem claims, technique status /
notes / timestamps, or anything else in the DB.

Tables missing from older DBs are treated as empty (no crash).
"""
import argparse
import json
import re
import sqlite3
from pathlib import Path

PROBLEM_ALLOWLIST = [
    "id", "title", "statement_md", "tags", "difficulty",
    "time_limit_ms", "memory_limit_mb", "source", "tests",
    "brute_force_src", "brute_force_lang", "hints",
    "primary_technique_id",
]
TECHNIQUE_ALLOWLIST = ["id", "name"]
NEVER_EXPORT = [
    "problems.notes_md",
    "submissions (all columns)",
    "contests (all columns)",
    "reimplementation_schedule (all columns)",
    "problem_claims (all columns)",
    "techniques.status / status_updated_at / notes_md",
]


def table_exists(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone()
    return row is not None


def table_columns(conn: sqlite3.Connection, name: str) -> set:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({name})").fetchall()}


def safe_filename(problem_id: str) -> str:
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", problem_id).strip("._") or "problem"
    return f"{name}.json"


def load_problems(conn: sqlite3.Connection):
    if not table_exists(conn, "problems"):
        return []
    cols = table_columns(conn, "problems")
    # Explicit allowlist of scalar columns; notes_md deliberately absent.
    scalar = ["id", "title", "statement_md", "tags", "difficulty",
              "time_limit_ms", "memory_limit_mb", "source",
              "brute_force_src", "brute_force_lang"]
    if "primary_technique_id" in cols:
        scalar.append("primary_technique_id")
    if "hints" in cols:
        scalar.append("hints")
    scalar = [c for c in scalar if c in cols]
    rows = conn.execute(
        f"SELECT {', '.join(scalar)} FROM problems ORDER BY id"
    ).fetchall()
    idx = {c: i for i, c in enumerate(scalar)}
    has_tests = table_exists(conn, "test_cases")

    problems = []
    for r in rows:
        def g(col, default=None):
            return r[idx[col]] if col in idx else default

        try:
            tags = json.loads(g("tags") or "[]")
        except (json.JSONDecodeError, TypeError):
            tags = []
        try:
            hints = json.loads(g("hints") or "[]") if "hints" in idx else []
        except (json.JSONDecodeError, TypeError):
            hints = []

        tests = []
        if has_tests:
            for tid, inp, out in conn.execute(
                "SELECT id, input, expected_output FROM test_cases WHERE problem_id=? ORDER BY id",
                (g("id"),),
            ).fetchall():
                tests.append({"id": tid, "input": inp, "expected_output": out})

        problems.append({
            "id": g("id"),
            "title": g("title"),
            "statement_md": g("statement_md"),
            "tags": tags,
            "difficulty": g("difficulty"),
            "time_limit_ms": g("time_limit_ms"),
            "memory_limit_mb": g("memory_limit_mb"),
            "source": g("source"),
            "tests": tests,
            "brute_force_src": g("brute_force_src"),
            "brute_force_lang": g("brute_force_lang"),
            "primary_technique_id": g("primary_technique_id"),
            "hints": hints,
        })
    return problems


def load_techniques(conn: sqlite3.Connection):
    if not table_exists(conn, "techniques"):
        return []
    # id + name ONLY: status / notes / timestamps never leave the machine.
    return [
        {"id": tid, "name": name}
        for tid, name in conn.execute("SELECT id, name FROM techniques ORDER BY id").fetchall()
    ]


def main():
    ap = argparse.ArgumentParser(description="Export DB into a shareable problem pack.")
    ap.add_argument("db_path")
    ap.add_argument("out_dir")
    ap.add_argument("--name", default=None, help="Pack name (defaults to out dir name)")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    pack_name = args.name or out_dir.name
    out_dir.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(args.db_path)
    problems = load_problems(conn)
    techniques = load_techniques(conn)
    conn.close()

    problem_files = []
    for p in problems:
        fname = safe_filename(p["id"])
        (out_dir / fname).write_text(json.dumps(p, indent=2, ensure_ascii=False) + "\n")
        problem_files.append(fname)

    (out_dir / "pack.json").write_text(json.dumps({
        "pack_name": pack_name,
        "techniques": techniques,
        "problem_files": sorted(problem_files),
    }, indent=2, ensure_ascii=False) + "\n")

    print(f"Problem allowlist: {', '.join(PROBLEM_ALLOWLIST)}")
    print(f"Technique allowlist: {', '.join(TECHNIQUE_ALLOWLIST)}")
    print(f"Never exported: {', '.join(NEVER_EXPORT)}")
    print(f"Exported {len(problems)} problem(s), {len(techniques)} technique(s) -> {out_dir}")


if __name__ == "__main__":
    main()
