use crate::models::{
    Contest, FailureCategory, Problem, ProblemClaim, Submission, Technique, TechniqueStatus,
    TestCase, Verdict,
};
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
            brute_force_lang TEXT,
            notes_md TEXT
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
            penalty_minutes INTEGER NOT NULL DEFAULT 20,
            team_members TEXT,             -- JSON array
            driver TEXT
        );

        CREATE TABLE IF NOT EXISTS problem_claims (
            contest_id TEXT NOT NULL,
            problem_id TEXT NOT NULL,
            claimed_by TEXT NOT NULL,
            status TEXT NOT NULL,
            PRIMARY KEY (contest_id, problem_id)
        );

        CREATE TABLE IF NOT EXISTS techniques (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'NotStarted',
            status_updated_at TEXT NOT NULL,
            notes_md TEXT
        );
        ",
    )?;
    let _ = conn.execute("ALTER TABLE problems ADD COLUMN notes_md TEXT", []);
    let _ = conn.execute("ALTER TABLE problems ADD COLUMN primary_technique_id TEXT", []);
    let _ = conn.execute("ALTER TABLE submissions ADD COLUMN failure_category TEXT", []);
    let _ = conn.execute("ALTER TABLE contests ADD COLUMN team_members TEXT", []);
    let _ = conn.execute("ALTER TABLE contests ADD COLUMN driver TEXT", []);
    Ok(conn)
}

pub fn insert_problem(conn: &Connection, p: &Problem) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO problems
         (id, title, statement_md, tags, difficulty, time_limit_ms, memory_limit_mb, source, brute_force_src, brute_force_lang, notes_md, primary_technique_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
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
            p.notes_md,
            p.primary_technique_id,
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

pub fn update_problem_notes(conn: &Connection, problem_id: &str, notes_md: &str) -> SqlResult<()> {
    conn.execute(
        "UPDATE problems SET notes_md = ?1 WHERE id = ?2",
        params![notes_md, problem_id],
    )?;
    Ok(())
}

pub fn list_techniques(conn: &Connection) -> SqlResult<Vec<Technique>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, status, status_updated_at, notes_md FROM techniques ORDER BY name",
    )?;
    let rows = stmt.query_map([], |row| {
        let status_str: String = row.get(2)?;
        Ok(Technique {
            id: row.get(0)?,
            name: row.get(1)?,
            status: str_to_technique_status(&status_str),
            status_updated_at: row.get(3)?,
            notes_md: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn upsert_technique(conn: &Connection, t: &Technique) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO techniques (id, name, status, status_updated_at, notes_md)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            t.id,
            t.name,
            technique_status_to_str(&t.status),
            t.status_updated_at,
            t.notes_md,
        ],
    )?;
    Ok(())
}

pub fn update_technique_status(
    conn: &Connection,
    technique_id: &str,
    status: &TechniqueStatus,
    updated_at: &str,
) -> SqlResult<usize> {
    Ok(conn.execute(
        "UPDATE techniques SET status = ?1, status_updated_at = ?2 WHERE id = ?3",
        params![technique_status_to_str(status), updated_at, technique_id],
    )? as usize)
}

pub fn update_technique_notes(conn: &Connection, technique_id: &str, notes_md: &str) -> SqlResult<()> {
    conn.execute(
        "UPDATE techniques SET notes_md = ?1 WHERE id = ?2",
        params![notes_md, technique_id],
    )?;
    Ok(())
}

/// Records that a reassessment happened (e.g. a recall session) without
/// changing the status itself.
pub fn touch_technique(conn: &Connection, technique_id: &str, updated_at: &str) -> SqlResult<usize> {
    Ok(conn.execute(
        "UPDATE techniques SET status_updated_at = ?1 WHERE id = ?2",
        params![updated_at, technique_id],
    )? as usize)
}

pub fn bulk_update_technique_status(
    conn: &Connection,
    technique_ids: &[String],
    status: &TechniqueStatus,
    updated_at: &str,
) -> SqlResult<usize> {
    let status_str = technique_status_to_str(status);
    let mut updated = 0;
    for id in technique_ids {
        updated += conn.execute(
            "UPDATE techniques SET status = ?1, status_updated_at = ?2 WHERE id = ?3",
            params![status_str, updated_at, id],
        )? as usize;
    }
    Ok(updated)
}

fn str_to_technique_status(s: &str) -> TechniqueStatus {
    match s {
        "Learning" => TechniqueStatus::Learning,
        "Assimilated" => TechniqueStatus::Assimilated,
        "Rusty" => TechniqueStatus::Rusty,
        _ => TechniqueStatus::NotStarted,
    }
}

fn technique_status_to_str(s: &TechniqueStatus) -> &'static str {
    match s {
        TechniqueStatus::NotStarted => "NotStarted",
        TechniqueStatus::Learning => "Learning",
        TechniqueStatus::Assimilated => "Assimilated",
        TechniqueStatus::Rusty => "Rusty",
    }
}

pub fn list_problems(conn: &Connection) -> SqlResult<Vec<Problem>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, statement_md, tags, difficulty, time_limit_ms, memory_limit_mb, source, brute_force_src, brute_force_lang, notes_md, primary_technique_id FROM problems",
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
            notes_md: row.get(10)?,
            primary_technique_id: row.get(11).ok().flatten(),
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
        "INSERT INTO submissions (id, problem_id, language, source_code, verdict, submitted_at, context, failure_category)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            s.id,
            s.problem_id,
            s.language,
            s.source_code,
            verdict_to_str(&s.verdict),
            s.submitted_at,
            serde_json::to_string(&s.context).unwrap(),
            s.failure_category.as_ref().map(failure_category_to_str),
        ],
    )?;
    Ok(())
}

/// Tags the most recent non-AC submission for a problem. Classification happens
/// after the verdict is known, so this is a separate step from insert.
pub fn classify_latest_submission(
    conn: &Connection,
    problem_id: &str,
    category: &FailureCategory,
) -> SqlResult<usize> {
    Ok(conn.execute(
        "UPDATE submissions SET failure_category = ?1 WHERE id = (
            SELECT id FROM submissions
            WHERE problem_id = ?2 AND verdict != 'AC'
            ORDER BY submitted_at DESC LIMIT 1
        )",
        params![failure_category_to_str(category), problem_id],
    )? as usize)
}

pub fn insert_contest(conn: &Connection, c: &Contest) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO contests (id, name, problem_ids, duration_minutes, started_at, penalty_minutes, team_members, driver)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            c.id,
            c.name,
            serde_json::to_string(&c.problem_ids).unwrap(),
            c.duration_minutes,
            c.started_at,
            c.penalty_minutes,
            serde_json::to_string(&c.team_members).unwrap(),
            c.driver,
        ],
    )?;
    Ok(())
}

pub fn list_contests(conn: &Connection) -> SqlResult<Vec<Contest>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, problem_ids, duration_minutes, started_at, penalty_minutes, team_members, driver FROM contests ORDER BY started_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let ids_json: String = row.get(2)?;
        let team_json: Option<String> = row.get(6)?;
        Ok(Contest {
            id: row.get(0)?,
            name: row.get(1)?,
            problem_ids: serde_json::from_str(&ids_json).unwrap_or_default(),
            duration_minutes: row.get::<_, i64>(3)? as u32,
            started_at: row.get(4)?,
            penalty_minutes: row.get::<_, i64>(5)? as u32,
            team_members: team_json.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
            driver: row.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn upsert_claim(conn: &Connection, claim: &ProblemClaim) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO problem_claims (contest_id, problem_id, claimed_by, status) VALUES (?1, ?2, ?3, ?4)",
        params![claim.contest_id, claim.problem_id, claim.claimed_by, claim.status],
    )?;
    Ok(())
}

pub fn list_claims(conn: &Connection, contest_id: &str) -> SqlResult<Vec<ProblemClaim>> {
    let mut stmt = conn.prepare(
        "SELECT contest_id, problem_id, claimed_by, status FROM problem_claims WHERE contest_id = ?1",
    )?;
    let rows = stmt.query_map(params![contest_id], |row| {
        Ok(ProblemClaim {
            contest_id: row.get(0)?,
            problem_id: row.get(1)?,
            claimed_by: row.get(2)?,
            status: row.get(3)?,
        })
    })?;
    rows.collect()
}

pub fn clear_claims(conn: &Connection, contest_id: &str) -> SqlResult<()> {
    conn.execute("DELETE FROM problem_claims WHERE contest_id = ?1", params![contest_id])?;
    Ok(())
}

pub fn list_submissions(conn: &Connection) -> SqlResult<Vec<Submission>> {
    let mut stmt = conn.prepare(
        "SELECT id, problem_id, language, source_code, verdict, submitted_at, context, failure_category FROM submissions ORDER BY submitted_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let verdict_str: String = row.get(4)?;
        let context_json: String = row.get(6)?;
        let failure_str: Option<String> = row.get(7).ok().flatten();
        Ok(Submission {
            id: row.get(0)?,
            problem_id: row.get(1)?,
            language: row.get(2)?,
            source_code: row.get(3)?,
            verdict: str_to_verdict(&verdict_str),
            submitted_at: row.get(5)?,
            context: serde_json::from_str(&context_json).unwrap_or(crate::models::SubmissionContext::Practice),
            failure_category: failure_str.map(|s| str_to_failure_category(&s)),
        })
    })?;
    rows.collect()
}

pub fn list_submissions_by_problem(conn: &Connection, problem_id: &str) -> SqlResult<Vec<Submission>> {
    let mut stmt = conn.prepare(
        "SELECT id, problem_id, language, source_code, verdict, submitted_at, context, failure_category FROM submissions WHERE problem_id = ?1 ORDER BY submitted_at DESC",
    )?;
    let rows = stmt.query_map(params![problem_id], |row| {
        let verdict_str: String = row.get(4)?;
        let context_json: String = row.get(6)?;
        let failure_str: Option<String> = row.get(7).ok().flatten();
        Ok(Submission {
            id: row.get(0)?,
            problem_id: row.get(1)?,
            language: row.get(2)?,
            source_code: row.get(3)?,
            verdict: str_to_verdict(&verdict_str),
            submitted_at: row.get(5)?,
            context: serde_json::from_str(&context_json).unwrap_or(crate::models::SubmissionContext::Practice),
            failure_category: failure_str.map(|s| str_to_failure_category(&s)),
        })
    })?;
    rows.collect()
}

pub fn clear_submissions(conn: &Connection) -> SqlResult<usize> {
    Ok(conn.execute("DELETE FROM submissions", [])? as usize)
}

pub fn clear_all_data(conn: &Connection) -> SqlResult<()> {
    conn.execute("DELETE FROM submissions", [])?;
    conn.execute("DELETE FROM contests", [])?;
    Ok(())
}

fn str_to_verdict(s: &str) -> Verdict {
    match s {
        "AC" => Verdict::Accepted,
        "WA" => Verdict::WrongAnswer,
        "TLE" => Verdict::TimeLimitExceeded,
        "RE" => Verdict::RuntimeError,
        "CE" => Verdict::CompileError,
        _ => Verdict::WrongAnswer,
    }
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

fn str_to_failure_category(s: &str) -> FailureCategory {
    match s {
        "Conceptual" => FailureCategory::Conceptual,
        "Implementation" => FailureCategory::Implementation,
        "StlGap" => FailureCategory::StlGap,
        "Indexing" => FailureCategory::Indexing,
        "Careless" => FailureCategory::Careless,
        "MisreadStatement" => FailureCategory::MisreadStatement,
        "PrematureTechnique" => FailureCategory::PrematureTechnique,
        _ => FailureCategory::Careless,
    }
}

fn failure_category_to_str(c: &FailureCategory) -> &'static str {
    match c {
        FailureCategory::Conceptual => "Conceptual",
        FailureCategory::Implementation => "Implementation",
        FailureCategory::StlGap => "StlGap",
        FailureCategory::Indexing => "Indexing",
        FailureCategory::Careless => "Careless",
        FailureCategory::MisreadStatement => "MisreadStatement",
        FailureCategory::PrematureTechnique => "PrematureTechnique",
    }
}
