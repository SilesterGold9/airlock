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
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("cp-trainer.sqlite");
            let conn = db::init(&db_path).expect("failed to init database");
            app.manage(AppState {
                conn: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_problems,
            commands::save_problem,
            commands::submit_solution,
            commands::create_contest,
            commands::run_stress_test,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
