// Prevents an extra console window on Windows in release builds. No-op elsewhere.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod judge;
mod models;

use commands::AppState;
use std::sync::Mutex;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("airlock.sqlite");
            // migrate from old identifier com.silvestre.cptrainer if needed
            if !db_path.exists() {
                if let Some(old_dir) = app
                    .path()
                    .app_data_dir()
                    .ok()
                    .and_then(|p| p.parent().map(|pp| pp.join("com.silvestre.cptrainer")))
                {
                    let old_path = old_dir.join("cp-trainer.sqlite");
                    if old_path.exists() {
                        let _ = std::fs::create_dir_all(old_dir.parent().unwrap_or(&app_dir));
                        let _ = std::fs::copy(&old_path, &db_path);
                    }
                    let old_new_path = old_dir.join("airlock.sqlite");
                    if old_new_path.exists() && !db_path.exists() {
                        let _ = std::fs::copy(&old_new_path, &db_path);
                    }
                }
                // also handle previous airlock location with old file name
                let legacy = app_dir.join("cp-trainer.sqlite");
                if legacy.exists() && !db_path.exists() {
                    let _ = std::fs::copy(&legacy, &db_path);
                }
            }
            let conn = db::init(&db_path).expect("failed to init database");
            app.manage(AppState {
                conn: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_problems,
            commands::save_problem,
            commands::update_problem_notes,
            commands::submit_solution,
            commands::run_solution,
            commands::create_contest,
            commands::run_stress_test,
            commands::list_submissions,
            commands::list_submissions_by_problem,
            commands::list_contests,
            commands::clear_submissions,
            commands::clear_all_data,
            commands::upsert_claim,
            commands::list_claims,
            commands::set_contest_driver,
            commands::list_techniques,
            commands::save_technique,
            commands::update_technique_status,
            commands::update_technique_notes,
            commands::bulk_update_technique_status,
            commands::classify_submission,
            commands::touch_technique,
            commands::list_due_reimplementations,
            commands::list_rank_themes,
            commands::create_rank_theme,
            commands::set_active_theme,
            commands::get_rank_state,
            commands::check_rank_suggestion,
            commands::confirm_rank_up,
            commands::list_rank_reflections,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
