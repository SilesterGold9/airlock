use crate::db;
use crate::judge;
use crate::models::{Contest, JudgeReport, Problem, Submission, SubmissionContext, Verdict};
use chrono::Utc;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

pub struct AppState {
    pub conn: Mutex<Connection>,
}

#[tauri::command]
pub fn list_problems(state: State<AppState>) -> Result<Vec<Problem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut problems = db::list_problems(&conn).map_err(|e| e.to_string())?;
    for p in problems.iter_mut() {
        p.tests = db::get_tests(&conn, &p.id).map_err(|e| e.to_string())?;
    }
    Ok(problems)
}

#[tauri::command]
pub fn save_problem(state: State<AppState>, mut problem: Problem) -> Result<Problem, String> {
    if problem.id.is_empty() {
        problem.id = Uuid::new_v4().to_string();
    }
    for t in problem.tests.iter_mut() {
        if t.id.is_empty() {
            t.id = Uuid::new_v4().to_string();
        }
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::insert_problem(&conn, &problem).map_err(|e| e.to_string())?;
    Ok(problem)
}

/// Compiles + runs `source_code` against every stored test case for `problem_id`,
/// records the submission, and returns the full per-test report.
#[tauri::command]
pub fn submit_solution(
    state: State<AppState>,
    problem_id: String,
    language: String,
    source_code: String,
    context: SubmissionContext,
) -> Result<JudgeReport, String> {
    let (tests, time_limit_ms) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let tests = db::get_tests(&conn, &problem_id).map_err(|e| e.to_string())?;
        let problems = db::list_problems(&conn).map_err(|e| e.to_string())?;
        let tl = problems
            .iter()
            .find(|p| p.id == problem_id)
            .map(|p| p.time_limit_ms)
            .unwrap_or(2000);
        (tests, tl)
    };

    let report = judge::run_judge(&language, &source_code, &tests, time_limit_ms)?;

    let submission = Submission {
        id: Uuid::new_v4().to_string(),
        problem_id,
        language,
        source_code,
        verdict: report.overall_verdict.clone(),
        submitted_at: Utc::now().to_rfc3339(),
        context,
    };
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::insert_submission(&conn, &submission).map_err(|e| e.to_string())?;

    Ok(report)
}

#[tauri::command]
pub fn create_contest(
    state: State<AppState>,
    name: String,
    problem_ids: Vec<String>,
    duration_minutes: u32,
) -> Result<Contest, String> {
    let contest = Contest {
        id: Uuid::new_v4().to_string(),
        name,
        problem_ids,
        duration_minutes,
        started_at: Some(Utc::now().to_rfc3339()),
        penalty_minutes: 20, // ICPC default
    };
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::insert_contest(&conn, &contest).map_err(|e| e.to_string())?;
    Ok(contest)
}

#[tauri::command]
pub fn run_stress_test(
    language: String,
    candidate_src: String,
    brute_force_src: String,
    generator_src: String,
    max_cases: u32,
    time_limit_ms: u64,
) -> Result<Option<(String, String, String)>, String> {
    judge::run_stress_test(
        &language,
        &candidate_src,
        &brute_force_src,
        &generator_src,
        max_cases,
        time_limit_ms,
    )
}

#[tauri::command]
pub fn list_submissions(state: State<AppState>) -> Result<Vec<Submission>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::list_submissions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_submissions_by_problem(
    state: State<AppState>,
    problem_id: String,
) -> Result<Vec<Submission>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::list_submissions_by_problem(&conn, &problem_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_contests(state: State<AppState>) -> Result<Vec<Contest>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::list_contests(&conn).map_err(|e| e.to_string())
}
