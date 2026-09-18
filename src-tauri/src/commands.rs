use crate::db;
use crate::judge;
use crate::models::{
    Contest, FailureCategory, JudgeReport, Problem, ProblemClaim, Submission, SubmissionContext,
    Technique, TechniqueStatus,
};
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

#[tauri::command]
pub fn update_problem_notes(
    state: State<AppState>,
    problem_id: String,
    notes_md: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::update_problem_notes(&conn, &problem_id, &notes_md).map_err(|e| e.to_string())
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
        failure_category: None,
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
    team_members: Option<Vec<String>>,
    driver: Option<String>,
) -> Result<Contest, String> {
    let contest = Contest {
        id: Uuid::new_v4().to_string(),
        name,
        problem_ids,
        duration_minutes,
        started_at: Some(Utc::now().to_rfc3339()),
        penalty_minutes: 20, // ICPC default
        team_members: team_members.unwrap_or_default(),
        driver,
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

#[tauri::command]
pub fn upsert_claim(
    state: State<AppState>,
    contest_id: String,
    problem_id: String,
    claimed_by: String,
    status: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let claim = ProblemClaim {
        contest_id,
        problem_id,
        claimed_by,
        status,
    };
    db::upsert_claim(&conn, &claim).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_claims(state: State<AppState>, contest_id: String) -> Result<Vec<ProblemClaim>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::list_claims(&conn, &contest_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_contest_driver(
    state: State<AppState>,
    contest_id: String,
    driver: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut contests = db::list_contests(&conn).map_err(|e| e.to_string())?;
    if let Some(c) = contests.iter_mut().find(|x| x.id == contest_id) {
        c.driver = Some(driver);
        db::insert_contest(&conn, c).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("contest not found".into())
    }
}

#[tauri::command]
pub fn list_techniques(state: State<AppState>) -> Result<Vec<Technique>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::list_techniques(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_technique(state: State<AppState>, name: String) -> Result<Technique, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("technique name is required".into());
    }
    let technique = Technique {
        id: Uuid::new_v4().to_string(),
        name,
        status: TechniqueStatus::NotStarted,
        status_updated_at: Utc::now().to_rfc3339(),
        notes_md: None,
    };
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::upsert_technique(&conn, &technique).map_err(|e| e.to_string())?;
    Ok(technique)
}

#[tauri::command]
pub fn update_technique_status(
    state: State<AppState>,
    technique_id: String,
    status: TechniqueStatus,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let updated =
        db::update_technique_status(&conn, &technique_id, &status, &Utc::now().to_rfc3339())
            .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("technique not found".into());
    }
    Ok(())
}

#[tauri::command]
pub fn update_technique_notes(
    state: State<AppState>,
    technique_id: String,
    notes_md: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::update_technique_notes(&conn, &technique_id, &notes_md).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn bulk_update_technique_status(
    state: State<AppState>,
    technique_ids: Vec<String>,
    status: TechniqueStatus,
) -> Result<usize, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::bulk_update_technique_status(&conn, &technique_ids, &status, &Utc::now().to_rfc3339())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn classify_submission(
    state: State<AppState>,
    problem_id: String,
    failure_category: FailureCategory,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let updated = db::classify_latest_submission(&conn, &problem_id, &failure_category)
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("no recent non-AC submission to classify".into());
    }
    Ok(())
}

#[tauri::command]
pub fn touch_technique(state: State<AppState>, technique_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let updated = db::touch_technique(&conn, &technique_id, &Utc::now().to_rfc3339())
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("technique not found".into());
    }
    Ok(())
}

#[tauri::command]
pub fn clear_submissions(state: State<AppState>) -> Result<usize, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::clear_submissions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_all_data(state: State<AppState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::clear_all_data(&conn).map_err(|e| e.to_string())
}
