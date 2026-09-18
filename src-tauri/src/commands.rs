use crate::db;
use crate::judge;
use crate::models::{
    Contest, FailureCategory, JudgeReport, Problem, ProblemClaim, RankReflection, RankState,
    RankTheme, ReimplementationSchedule, Submission, SubmissionContext, Technique,
    TechniqueStatus, Verdict,
};
use chrono::Utc;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

pub struct AppState {
    pub conn: Mutex<Connection>,
}

fn load_tests_for_judge(
    state: &State<AppState>,
    problem_id: &str,
) -> Result<(Vec<crate::models::TestCase>, u64), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tests = db::get_tests(&conn, problem_id).map_err(|e| e.to_string())?;
    let problems = db::list_problems(&conn).map_err(|e| e.to_string())?;
    let tl = problems
        .iter()
        .find(|p| p.id == problem_id)
        .map(|p| p.time_limit_ms)
        .unwrap_or(2000);
    Ok((tests, tl))
}

/// Same as submit_solution but logs nothing: quick check against the tests
/// without touching submission history, statuses, or schedules.
#[tauri::command]
pub fn run_solution(
    state: State<AppState>,
    problem_id: String,
    language: String,
    source_code: String,
) -> Result<JudgeReport, String> {
    let (tests, time_limit_ms) = load_tests_for_judge(&state, &problem_id)?;
    judge::run_judge(&language, &source_code, &tests, time_limit_ms)
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
    hints_revealed: Option<u8>,
) -> Result<JudgeReport, String> {
    let (tests, time_limit_ms) = load_tests_for_judge(&state, &problem_id)?;

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
        hints_revealed,
    };
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::insert_submission(&conn, &submission).map_err(|e| e.to_string())?;
    if matches!(report.overall_verdict, Verdict::Accepted) {
        db::record_ac_for_reimplementation(&conn, &submission.problem_id)
            .map_err(|e| e.to_string())?;
    }

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
pub fn list_due_reimplementations(
    state: State<AppState>,
) -> Result<Vec<ReimplementationSchedule>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::list_due_reimplementations(&conn, &Utc::now().to_rfc3339()).map_err(|e| e.to_string())
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

#[tauri::command]
pub fn list_rank_themes(state: State<AppState>) -> Result<Vec<RankTheme>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::list_rank_themes(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_rank_theme(
    state: State<AppState>,
    system_name: String,
    tier_names: Vec<String>,
    tier_colors: Vec<String>,
) -> Result<RankTheme, String> {
    if tier_names.len() != 8 {
        return Err("tier_names must contain exactly 8 entries".into());
    }
    if tier_colors.len() != 8 {
        return Err("tier_colors must contain exactly 8 entries".into());
    }
    let name = system_name.trim().to_string();
    if name.is_empty() {
        return Err("system name is required".into());
    }
    let theme = RankTheme {
        id: Uuid::new_v4().to_string(),
        system_name: name,
        tier_names,
        tier_colors,
        is_default: false,
    };
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::insert_rank_theme(&conn, &theme).map_err(|e| e.to_string())?;
    Ok(theme)
}

#[tauri::command]
pub fn set_active_theme(state: State<AppState>, theme_id: String) -> Result<RankState, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let known = db::get_rank_theme(&conn, &theme_id).map_err(|e| e.to_string())?;
    if known.is_none() {
        return Err("unknown theme".into());
    }
    let mut rank = db::get_rank_state(&conn).map_err(|e| e.to_string())?;
    rank.theme_id = theme_id;
    db::update_rank_state(&conn, &rank).map_err(|e| e.to_string())?;
    Ok(rank)
}

#[tauri::command]
pub fn get_rank_state(state: State<AppState>) -> Result<RankState, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_rank_state(&conn).map_err(|e| e.to_string())
}

/// Suggestion starting point (tunable):
/// readiness = 0.6 * technique_readiness + 0.4 * contest_signal, where
/// technique_readiness = fraction of techniques with status Assimilated
/// (0 when none tracked) and contest_signal = min(1, non-upsolve Contest
/// AC count / 5). Suggest current+1 (cap 7) when
/// readiness >= 0.15 * (current+1). Tiers 5-7 additionally require at least
/// one non-upsolve Contest AC. Never auto-increments current_stars; clears
/// pending when already at 7 or the threshold is not met.
#[tauri::command]
pub fn check_rank_suggestion(state: State<AppState>) -> Result<RankState, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut rank = db::get_rank_state(&conn).map_err(|e| e.to_string())?;
    if rank.current_stars >= 7 {
        rank.pending_suggestion = None;
        db::update_rank_state(&conn, &rank).map_err(|e| e.to_string())?;
        return Ok(rank);
    }
    let techniques = db::list_techniques(&conn).map_err(|e| e.to_string())?;
    let technique_readiness = if techniques.is_empty() {
        0.0
    } else {
        let assimilated = techniques
            .iter()
            .filter(|t| t.status == TechniqueStatus::Assimilated)
            .count() as f64;
        assimilated / techniques.len() as f64
    };
    let submissions = db::list_submissions(&conn).map_err(|e| e.to_string())?;
    let mut contest_ac_count: u32 = 0;
    for s in &submissions {
        if !matches!(s.verdict, Verdict::Accepted) {
            continue;
        }
        if let SubmissionContext::Contest { upsolve, .. } = &s.context {
            if !upsolve {
                contest_ac_count += 1;
            }
        }
    }
    let contest_signal = ((contest_ac_count as f64) / 5.0).min(1.0);
    let readiness = 0.6 * technique_readiness + 0.4 * contest_signal;
    let next = rank.current_stars + 1;
    let gated = next >= 5 && contest_ac_count == 0;
    if !gated && readiness >= 0.15 * (next as f64) {
        rank.pending_suggestion = Some(next);
    } else {
        rank.pending_suggestion = None;
    }
    db::update_rank_state(&conn, &rank).map_err(|e| e.to_string())?;
    Ok(rank)
}

#[tauri::command]
pub fn confirm_rank_up(
    state: State<AppState>,
    star_level: u8,
    reflection_md: String,
) -> Result<RankState, String> {
    if star_level == 0 || star_level > 7 {
        return Err("star level must be between 1 and 7".into());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut rank = db::get_rank_state(&conn).map_err(|e| e.to_string())?;
    if star_level != rank.current_stars + 1 {
        return Err("star level must equal current stars plus one".into());
    }
    let now = Utc::now().to_rfc3339();
    rank.current_stars = star_level;
    rank.achieved_at.insert(star_level.to_string(), now.clone());
    if rank.pending_suggestion == Some(star_level) {
        rank.pending_suggestion = None;
    }
    let reflection = RankReflection {
        id: Uuid::new_v4().to_string(),
        star_level,
        reflection_md,
        created_at: now,
    };
    db::insert_rank_reflection(&conn, &reflection).map_err(|e| e.to_string())?;
    db::update_rank_state(&conn, &rank).map_err(|e| e.to_string())?;
    Ok(rank)
}

#[tauri::command]
pub fn list_rank_reflections(state: State<AppState>) -> Result<Vec<RankReflection>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::list_rank_reflections(&conn).map_err(|e| e.to_string())
}
