use crate::models::{
    Contest, FailureCategory, Problem, ProblemClaim, RankReflection, RankState, RankTheme,
    ReimplementationSchedule, Submission, Technique, TechniqueStatus, TestCase, Verdict,
};
use chrono::Utc;
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
            notes_md TEXT,
            hints TEXT NOT NULL DEFAULT '[]'   -- JSON array, up to 7
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

        CREATE TABLE IF NOT EXISTS reimplementation_schedule (
            problem_id TEXT PRIMARY KEY,
            last_ac_at TEXT NOT NULL,
            next_due_at TEXT NOT NULL,
            completed_reimplementations INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS rank_themes (
            id TEXT PRIMARY KEY,
            system_name TEXT NOT NULL,
            tier_names TEXT NOT NULL,    -- JSON array, exactly 8
            tier_colors TEXT NOT NULL,   -- JSON array, exactly 8 hex
            is_default INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS rank_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            theme_id TEXT NOT NULL,
            current_stars INTEGER NOT NULL DEFAULT 0,
            achieved_at TEXT NOT NULL DEFAULT '{}',  -- JSON object star -> ISO date
            pending_suggestion INTEGER
        );

        CREATE TABLE IF NOT EXISTS rank_reflections (
            id TEXT PRIMARY KEY,
            star_level INTEGER NOT NULL,
            reflection_md TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        ",
    )?;
    let _ = conn.execute("ALTER TABLE problems ADD COLUMN notes_md TEXT", []);
    let _ = conn.execute(
        "ALTER TABLE problems ADD COLUMN primary_technique_id TEXT",
        [],
    );
    let _ = conn.execute("ALTER TABLE problems ADD COLUMN hints TEXT", []);
    let _ = conn.execute(
        "ALTER TABLE submissions ADD COLUMN failure_category TEXT",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE submissions ADD COLUMN hints_revealed INTEGER",
        [],
    );
    let _ = conn.execute("ALTER TABLE contests ADD COLUMN team_members TEXT", []);
    let _ = conn.execute("ALTER TABLE contests ADD COLUMN driver TEXT", []);
    seed_rank_tables(&conn).ok();
    Ok(conn)
}

pub fn insert_problem(conn: &Connection, p: &Problem) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO problems
         (id, title, statement_md, tags, difficulty, time_limit_ms, memory_limit_mb, source, brute_force_src, brute_force_lang, notes_md, primary_technique_id, hints)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
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
            serde_json::to_string(&p.hints).unwrap(),
        ],
    )?;
    conn.execute(
        "DELETE FROM test_cases WHERE problem_id = ?1",
        params![p.id],
    )?;
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

pub fn update_technique_notes(
    conn: &Connection,
    technique_id: &str,
    notes_md: &str,
) -> SqlResult<()> {
    conn.execute(
        "UPDATE techniques SET notes_md = ?1 WHERE id = ?2",
        params![notes_md, technique_id],
    )?;
    Ok(())
}

/// Records that a reassessment happened (e.g. a recall session) without
/// changing the status itself.
pub fn touch_technique(
    conn: &Connection,
    technique_id: &str,
    updated_at: &str,
) -> SqlResult<usize> {
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

/// Advances the reimplementation schedule after an AC. First AC creates the
/// row due in 1 day; each following AC extends the interval (+3, then +7 days).
pub fn record_ac_for_reimplementation(conn: &Connection, problem_id: &str) -> SqlResult<()> {
    let existing: Option<u32> = match conn.query_row(
        "SELECT completed_reimplementations FROM reimplementation_schedule WHERE problem_id = ?1",
        params![problem_id],
        |row| row.get(0),
    ) {
        Ok(c) => Some(c),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return Err(e),
    };
    let (completed, interval_days) = match existing {
        None => (0, 1),
        Some(k) => (k + 1, if k + 1 == 1 { 3 } else { 7 }),
    };
    let now = Utc::now();
    let next_due = (now + chrono::Duration::days(interval_days)).to_rfc3339();
    conn.execute(
        "INSERT OR REPLACE INTO reimplementation_schedule
         (problem_id, last_ac_at, next_due_at, completed_reimplementations)
         VALUES (?1, ?2, ?3, ?4)",
        params![problem_id, now.to_rfc3339(), next_due, completed],
    )?;
    Ok(())
}

pub fn list_due_reimplementations(
    conn: &Connection,
    now_iso: &str,
) -> SqlResult<Vec<ReimplementationSchedule>> {
    let mut stmt = conn.prepare(
        "SELECT problem_id, last_ac_at, next_due_at, completed_reimplementations
         FROM reimplementation_schedule WHERE next_due_at <= ?1 ORDER BY next_due_at",
    )?;
    let rows = stmt.query_map(params![now_iso], |row| {
        Ok(ReimplementationSchedule {
            problem_id: row.get(0)?,
            last_ac_at: row.get(1)?,
            next_due_at: row.get(2)?,
            completed_reimplementations: row.get::<_, i64>(3)? as u32,
        })
    })?;
    rows.collect()
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
        "SELECT id, title, statement_md, tags, difficulty, time_limit_ms, memory_limit_mb, source, brute_force_src, brute_force_lang, notes_md, primary_technique_id, hints FROM problems",
    )?;
    let rows = stmt.query_map([], |row| {
        let tags_json: String = row.get(3)?;
        let hints_json: Option<String> = row.get(12).ok().flatten();
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
            hints: hints_json
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default(),
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
        "INSERT INTO submissions (id, problem_id, language, source_code, verdict, submitted_at, context, failure_category, hints_revealed)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            s.id,
            s.problem_id,
            s.language,
            s.source_code,
            verdict_to_str(&s.verdict),
            s.submitted_at,
            serde_json::to_string(&s.context).unwrap(),
            s.failure_category.as_ref().map(failure_category_to_str),
            s.hints_revealed,
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
            team_members: team_json
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default(),
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
    conn.execute(
        "DELETE FROM problem_claims WHERE contest_id = ?1",
        params![contest_id],
    )?;
    Ok(())
}

pub fn list_submissions(conn: &Connection) -> SqlResult<Vec<Submission>> {
    let mut stmt = conn.prepare(
        "SELECT id, problem_id, language, source_code, verdict, submitted_at, context, failure_category, hints_revealed FROM submissions ORDER BY submitted_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let verdict_str: String = row.get(4)?;
        let context_json: String = row.get(6)?;
        let failure_str: Option<String> = row.get(7).ok().flatten();
        let hints_revealed: Option<u8> = row.get(8).ok().flatten();
        Ok(Submission {
            id: row.get(0)?,
            problem_id: row.get(1)?,
            language: row.get(2)?,
            source_code: row.get(3)?,
            verdict: str_to_verdict(&verdict_str),
            submitted_at: row.get(5)?,
            context: serde_json::from_str(&context_json)
                .unwrap_or(crate::models::SubmissionContext::Practice),
            failure_category: failure_str.map(|s| str_to_failure_category(&s)),
            hints_revealed,
        })
    })?;
    rows.collect()
}

pub fn list_submissions_by_problem(
    conn: &Connection,
    problem_id: &str,
) -> SqlResult<Vec<Submission>> {
    let mut stmt = conn.prepare(
        "SELECT id, problem_id, language, source_code, verdict, submitted_at, context, failure_category, hints_revealed FROM submissions WHERE problem_id = ?1 ORDER BY submitted_at DESC",
    )?;
    let rows = stmt.query_map(params![problem_id], |row| {
        let verdict_str: String = row.get(4)?;
        let context_json: String = row.get(6)?;
        let failure_str: Option<String> = row.get(7).ok().flatten();
        let hints_revealed: Option<u8> = row.get(8).ok().flatten();
        Ok(Submission {
            id: row.get(0)?,
            problem_id: row.get(1)?,
            language: row.get(2)?,
            source_code: row.get(3)?,
            verdict: str_to_verdict(&verdict_str),
            submitted_at: row.get(5)?,
            context: serde_json::from_str(&context_json)
                .unwrap_or(crate::models::SubmissionContext::Practice),
            failure_category: failure_str.map(|s| str_to_failure_category(&s)),
            hints_revealed,
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

// --- Rank / journey system ---

fn default_rank_theme() -> RankTheme {
    RankTheme {
        id: "default".to_string(),
        system_name: "Airlock Standard".to_string(),
        tier_names: vec![
            "Docked".to_string(),
            "Hatch Ajar".to_string(),
            "Depressurized".to_string(),
            "Spacewalk".to_string(),
            "Orbital".to_string(),
            "Deep Orbit".to_string(),
            "Command Deck".to_string(),
            "Voidborne".to_string(),
        ],
        tier_colors: vec![
            "#64748b".to_string(),
            "#60a5fa".to_string(),
            "#34d399".to_string(),
            "#a3e635".to_string(),
            "#facc15".to_string(),
            "#fb923c".to_string(),
            "#c084fc".to_string(),
            "#eab308".to_string(),
        ],
        is_default: true,
    }
}

fn seed_rank_tables(conn: &Connection) -> SqlResult<()> {
    let theme_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM rank_themes", [], |row| row.get(0))?;
    if theme_count == 0 {
        let theme = default_rank_theme();
        conn.execute(
            "INSERT INTO rank_themes (id, system_name, tier_names, tier_colors, is_default)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                theme.id,
                theme.system_name,
                serde_json::to_string(&theme.tier_names).unwrap(),
                serde_json::to_string(&theme.tier_colors).unwrap(),
                1,
            ],
        )?;
    }
    let state_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM rank_state", [], |row| row.get(0))?;
    if state_count == 0 {
        conn.execute(
            "INSERT INTO rank_state (id, theme_id, current_stars, achieved_at, pending_suggestion)
             VALUES (1, 'default', 0, '{}', NULL)",
            [],
        )?;
    }
    Ok(())
}

pub fn list_rank_themes(conn: &Connection) -> SqlResult<Vec<RankTheme>> {
    let mut stmt = conn.prepare(
        "SELECT id, system_name, tier_names, tier_colors, is_default FROM rank_themes ORDER BY system_name",
    )?;
    let rows = stmt.query_map([], |row| {
        let names_json: String = row.get(2)?;
        let colors_json: String = row.get(3)?;
        let is_default_int: i64 = row.get(4)?;
        Ok(RankTheme {
            id: row.get(0)?,
            system_name: row.get(1)?,
            tier_names: serde_json::from_str(&names_json).unwrap_or_default(),
            tier_colors: serde_json::from_str(&colors_json).unwrap_or_default(),
            is_default: is_default_int != 0,
        })
    })?;
    rows.collect()
}

pub fn get_rank_theme(conn: &Connection, theme_id: &str) -> SqlResult<Option<RankTheme>> {
    let mut stmt = conn.prepare(
        "SELECT id, system_name, tier_names, tier_colors, is_default FROM rank_themes WHERE id = ?1",
    )?;
    let rows = stmt.query_map(params![theme_id], |row| {
        let names_json: String = row.get(2)?;
        let colors_json: String = row.get(3)?;
        let is_default_int: i64 = row.get(4)?;
        Ok(RankTheme {
            id: row.get(0)?,
            system_name: row.get(1)?,
            tier_names: serde_json::from_str(&names_json).unwrap_or_default(),
            tier_colors: serde_json::from_str(&colors_json).unwrap_or_default(),
            is_default: is_default_int != 0,
        })
    })?;
    for theme in rows {
        return Ok(Some(theme?));
    }
    Ok(None)
}

pub fn insert_rank_theme(conn: &Connection, theme: &RankTheme) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO rank_themes (id, system_name, tier_names, tier_colors, is_default)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            theme.id,
            theme.system_name,
            serde_json::to_string(&theme.tier_names).unwrap(),
            serde_json::to_string(&theme.tier_colors).unwrap(),
            if theme.is_default { 1 } else { 0 },
        ],
    )?;
    Ok(())
}

pub fn get_rank_state(conn: &Connection) -> SqlResult<RankState> {
    let res: SqlResult<(String, i64, String, Option<i64>)> = conn.query_row(
        "SELECT theme_id, current_stars, achieved_at, pending_suggestion FROM rank_state WHERE id = 1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    );
    match res {
        Ok((theme_id, current_stars, achieved_json, pending)) => Ok(RankState {
            theme_id,
            current_stars: current_stars as u8,
            achieved_at: serde_json::from_str(&achieved_json).unwrap_or_default(),
            pending_suggestion: pending.map(|v| v as u8),
        }),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // Self-heal if the seed row was removed.
            seed_rank_tables(conn).ok();
            Ok(RankState {
                theme_id: "default".to_string(),
                current_stars: 0,
                achieved_at: Default::default(),
                pending_suggestion: None,
            })
        }
        Err(e) => Err(e),
    }
}

pub fn update_rank_state(conn: &Connection, state: &RankState) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO rank_state (id, theme_id, current_stars, achieved_at, pending_suggestion)
         VALUES (1, ?1, ?2, ?3, ?4)",
        params![
            state.theme_id,
            state.current_stars as i64,
            serde_json::to_string(&state.achieved_at).unwrap(),
            state.pending_suggestion.map(|v| v as i64),
        ],
    )?;
    Ok(())
}

pub fn insert_rank_reflection(conn: &Connection, r: &RankReflection) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO rank_reflections (id, star_level, reflection_md, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![r.id, r.star_level as i64, r.reflection_md, r.created_at,],
    )?;
    Ok(())
}

pub fn list_rank_reflections(conn: &Connection) -> SqlResult<Vec<RankReflection>> {
    let mut stmt = conn.prepare(
        "SELECT id, star_level, reflection_md, created_at FROM rank_reflections ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(RankReflection {
            id: row.get(0)?,
            star_level: row.get::<_, i64>(1)? as u8,
            reflection_md: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        Contest, FailureCategory, ProblemClaim, SubmissionContext, Technique,
    };
    use std::path::Path;

    fn memdb() -> Connection {
        init(Path::new(":memory:")).expect("in-memory init")
    }

    fn sample_problem() -> Problem {
        Problem {
            id: "p1".to_string(),
            title: "A+B".to_string(),
            statement_md: "sum".to_string(),
            tags: vec!["implementation".to_string()],
            difficulty: 800,
            time_limit_ms: 1000,
            memory_limit_mb: 256,
            source: "self-authored".to_string(),
            tests: vec![TestCase {
                id: "t1".to_string(),
                input: "2 3\n".to_string(),
                expected_output: "5\n".to_string(),
            }],
            brute_force_src: None,
            brute_force_lang: None,
            notes_md: Some("my editorial".to_string()),
            primary_technique_id: Some("tech1".to_string()),
            hints: vec!["restate the ask".to_string(), "try small n".to_string()],
        }
    }

    fn submission(id: &str, verdict: Verdict, at: &str) -> Submission {
        Submission {
            id: id.to_string(),
            problem_id: "p1".to_string(),
            language: "cpp".to_string(),
            source_code: "code".to_string(),
            verdict,
            submitted_at: at.to_string(),
            context: SubmissionContext::Practice,
            failure_category: None,
            hints_revealed: None,
        }
    }

    #[test]
    fn problem_round_trip_with_tests_hints_and_link() {
        let conn = memdb();
        insert_problem(&conn, &sample_problem()).unwrap();
        let listed = list_problems(&conn).unwrap();
        assert_eq!(listed.len(), 1);
        // tests are stored separately
        assert!(listed[0].tests.is_empty());
        assert_eq!(listed[0].hints.len(), 2);
        assert_eq!(listed[0].primary_technique_id.as_deref(), Some("tech1"));
        assert_eq!(listed[0].notes_md.as_deref(), Some("my editorial"));
        let tests = get_tests(&conn, "p1").unwrap();
        assert_eq!(tests.len(), 1);
        assert_eq!(tests[0].expected_output, "5\n");
    }

    #[test]
    fn techniques_status_bulk_and_touch() {
        let conn = memdb();
        for (id, name) in [("a", "Prefix Sum"), ("b", "Two Pointers"), ("c", "DP")] {
            upsert_technique(
                &conn,
                &Technique {
                    id: id.to_string(),
                    name: name.to_string(),
                    status: TechniqueStatus::NotStarted,
                    status_updated_at: "2026-01-01T00:00:00Z".to_string(),
                    notes_md: None,
                },
            )
            .unwrap();
        }
        assert_eq!(list_techniques(&conn).unwrap().len(), 3);

        update_technique_status(&conn, "a", &TechniqueStatus::Learning, "2026-02-01T00:00:00Z").unwrap();
        bulk_update_technique_status(
            &conn,
            &["b".to_string(), "c".to_string()],
            &TechniqueStatus::Rusty,
            "2026-03-01T00:00:00Z",
        )
        .unwrap();

        // touch bumps the timestamp but keeps the status
        touch_technique(&conn, "a", "2026-04-01T00:00:00Z").unwrap();
        let after = list_techniques(&conn).unwrap();
        let a = after.iter().find(|x| x.id == "a").unwrap();
        assert_eq!(a.status, TechniqueStatus::Learning);
        assert_eq!(a.status_updated_at, "2026-04-01T00:00:00Z");
        let rusty = after.iter().filter(|x| x.status == TechniqueStatus::Rusty).count();
        assert_eq!(rusty, 2);
    }

    #[test]
    fn classify_tags_latest_non_ac_only() {
        let conn = memdb();
        insert_problem(&conn, &sample_problem()).unwrap();
        insert_submission(&conn, &submission("s1", Verdict::WrongAnswer, "2026-01-01T10:00:00Z")).unwrap();
        insert_submission(&conn, &submission("s2", Verdict::WrongAnswer, "2026-01-01T10:05:00Z")).unwrap();
        insert_submission(&conn, &submission("s3", Verdict::Accepted, "2026-01-01T10:10:00Z")).unwrap();

        classify_latest_submission(&conn, "p1", &FailureCategory::MisreadStatement).unwrap();

        let all = list_submissions_by_problem(&conn, "p1").unwrap();
        assert_eq!(all.len(), 3);
        // newest first: s3 (AC, untouched), s2 (tagged), s1 (untouched)
        assert_eq!(all[0].id, "s3");
        assert!(all[0].failure_category.is_none());
        assert_eq!(all[1].id, "s2");
        assert_eq!(all[1].failure_category, Some(FailureCategory::MisreadStatement));
        assert!(all[2].failure_category.is_none());
    }

    #[test]
    fn submission_round_trips_verdict_context_and_hints() {
        let conn = memdb();
        let mut s = submission("s1", Verdict::TimeLimitExceeded, "2026-01-01T10:00:00Z");
        s.context = SubmissionContext::Contest {
            contest_id: "c1".to_string(),
            upsolve: true,
        };
        s.hints_revealed = Some(3);
        insert_submission(&conn, &s).unwrap();
        let back = list_submissions(&conn).unwrap();
        assert_eq!(back.len(), 1);
        assert!(matches!(back[0].verdict, Verdict::TimeLimitExceeded));
        match &back[0].context {
            SubmissionContext::Contest { contest_id, upsolve } => {
                assert_eq!(contest_id, "c1");
                assert!(upsolve);
            }
            _ => panic!("expected contest context"),
        }
        assert_eq!(back[0].hints_revealed, Some(3));
    }

    #[test]
    fn schedule_intervals_advance_and_due_lists_past_rows() {
        let conn = memdb();
        record_ac_for_reimplementation(&conn, "p1").unwrap();
        record_ac_for_reimplementation(&conn, "p1").unwrap();
        record_ac_for_reimplementation(&conn, "p1").unwrap();
        let completed: u32 = conn
            .query_row(
                "SELECT completed_reimplementations FROM reimplementation_schedule WHERE problem_id = 'p1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(completed, 2, "first AC seeds 0, then +1 per reimplement");
        // fresh row is due in the future, not listed
        assert!(list_due_reimplementations(&conn, "2026-01-01T00:00:00Z").unwrap().is_empty());

        // a crafted past-due row is listed, earliest first
        conn.execute(
            "INSERT INTO reimplementation_schedule (problem_id, last_ac_at, next_due_at, completed_reimplementations)
             VALUES ('p2', '2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z', 0)",
            [],
        )
        .unwrap();
        let due = list_due_reimplementations(&conn, "2026-01-01T00:00:00Z").unwrap();
        assert_eq!(due.len(), 1);
        assert_eq!(due[0].problem_id, "p2");
    }

    #[test]
    fn contest_and_claims_round_trip() {
        let conn = memdb();
        insert_contest(
            &conn,
            &Contest {
                id: "c1".to_string(),
                name: "Virtual".to_string(),
                problem_ids: vec!["p1".to_string()],
                duration_minutes: 180,
                started_at: Some("2026-01-01T10:00:00Z".to_string()),
                penalty_minutes: 20,
                team_members: vec!["Al".to_string(), "Bo".to_string()],
                driver: Some("Al".to_string()),
            },
        )
        .unwrap();
        let contests = list_contests(&conn).unwrap();
        assert_eq!(contests.len(), 1);
        assert_eq!(contests[0].team_members.len(), 2);

        upsert_claim(
            &conn,
            &ProblemClaim {
                contest_id: "c1".to_string(),
                problem_id: "p1".to_string(),
                claimed_by: "Al".to_string(),
                status: "coding".to_string(),
            },
        )
        .unwrap();
        let claims = list_claims(&conn, "c1").unwrap();
        assert_eq!(claims.len(), 1);
        assert_eq!(claims[0].status, "coding");
    }

    #[test]
    fn rank_tables_seed_sane_defaults() {
        let conn = memdb();
        let state = get_rank_state(&conn).unwrap();
        assert_eq!(state.current_stars, 0);
        assert!(state.pending_suggestion.is_none());
        let themes = list_rank_themes(&conn).unwrap();
        assert!(!themes.is_empty());
        assert!(themes.iter().any(|x| x.is_default));
        let def = themes.iter().find(|x| x.is_default).unwrap();
        assert_eq!(def.tier_names.len(), 8);
        assert_eq!(def.tier_colors.len(), 8);
    }
}
