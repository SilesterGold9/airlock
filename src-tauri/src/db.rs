use crate::models::{Contest, Problem, Submission, TestCase, Verdict};
use rusqlite::{params, Connection, Result as SqlResult};
use std::path::Path;

pub fn init(path: &Path) -> SqlResult<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS problems (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            statement_md TEXT NOT NULL,
            tags TEXT NOT NULL,          -- JSON array
            difficulty INTEGER NOT NULL,
            time_limit_ms INTEGER NOT NULL,
            memory_limit_mb INTEGER NOT NULL,
            source TEXT NOT NULL,
            brute_force_src TEXT,
            brute_force_lang TEXT
        );

        CREATE TABLE IF NOT EXISTS test_cases (
            id TEXT PRIMARY KEY,
            problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
            input TEXT NOT NULL,
            expected_output TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            problem_id TEXT NOT NULL,
            language TEXT NOT NULL,
            source_code TEXT NOT NULL,
            verdict TEXT NOT NULL,
            submitted_at TEXT NOT NULL,
            context TEXT NOT NULL        -- JSON: {\"Practice\":null} or {\"Contest\":{\"contest_id\":...}}
        );

        CREATE TABLE IF NOT EXISTS contests (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            problem_ids TEXT NOT NULL,   -- JSON array
            duration_minutes INTEGER NOT NULL,
            started_at TEXT,
            penalty_minutes INTEGER NOT NULL DEFAULT 20
        );
        ",
    )?;
    Ok(conn)
}

pub fn insert_problem(conn: &Connection, p: &Problem) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO problems
         (id, title, statement_md, tags, difficulty, time_limit_ms, memory_limit_mb, source, brute_force_src, brute_force_lang)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            p.id,
            p.title,
            p.statement_md,
            serde_json::to_string(&p.tags).unwrap(),
            p.difficulty,
            p.time_limit_ms,
            p.memory_limit_mb,
            p.source,
            p.brute_force_src,
            p.brute_force_lang,
        ],
    )?;
    conn.execute("DELETE FROM test_cases WHERE problem_id = ?1", params![p.id])?;
    for t in &p.tests {
        conn.execute(
            "INSERT INTO test_cases (id, problem_id, input, expected_output) VALUES (?1, ?2, ?3, ?4)",
            params![t.id, p.id, t.input, t.expected_output],
        )?;
    }
    Ok(())
}

pub fn list_problems(conn: &Connection) -> SqlResult<Vec<Problem>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, statement_md, tags, difficulty, time_limit_ms, memory_limit_mb, source, brute_force_src, brute_force_lang FROM problems",
    )?;
    let rows = stmt.query_map([], |row| {
        let tags_json: String = row.get(3)?;
        Ok(Problem {
            id: row.get(0)?,
            title: row.get(1)?,
            statement_md: row.get(2)?,
            tags: serde_json::from_str(&tags_json).unwrap_or_default(),
            difficulty: row.get(4)?,
            time_limit_ms: row.get::<_, i64>(5)? as u64,
            memory_limit_mb: row.get::<_, i64>(6)? as u64,
            source: row.get(7)?,
            brute_force_src: row.get(8)?,
            brute_force_lang: row.get(9)?,
            tests: vec![], // populated separately via get_tests
        })
    })?;
    rows.collect()
}

pub fn get_tests(conn: &Connection, problem_id: &str) -> SqlResult<Vec<TestCase>> {
    let mut stmt =
        conn.prepare("SELECT id, input, expected_output FROM test_cases WHERE problem_id = ?1")?;
    let rows = stmt.query_map(params![problem_id], |row| {
        Ok(TestCase {
            id: row.get(0)?,
            input: row.get(1)?,
            expected_output: row.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn insert_submission(conn: &Connection, s: &Submission) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO submissions (id, problem_id, language, source_code, verdict, submitted_at, context)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            s.id,
            s.problem_id,
            s.language,
            s.source_code,
            verdict_to_str(&s.verdict),
            s.submitted_at,
            serde_json::to_string(&s.context).unwrap(),
        ],
    )?;
    Ok(())
}

pub fn insert_contest(conn: &Connection, c: &Contest) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO contests (id, name, problem_ids, duration_minutes, started_at, penalty_minutes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            c.id,
            c.name,
            serde_json::to_string(&c.problem_ids).unwrap(),
            c.duration_minutes,
            c.started_at,
            c.penalty_minutes,
        ],
    )?;
    Ok(())
}

fn verdict_to_str(v: &Verdict) -> &'static str {
    match v {
        Verdict::Accepted => "AC",
        Verdict::WrongAnswer => "WA",
        Verdict::TimeLimitExceeded => "TLE",
        Verdict::RuntimeError => "RE",
        Verdict::CompileError => "CE",
    }
}
