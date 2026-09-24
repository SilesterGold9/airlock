---
name: backend-conventions
description: Guides an agent writing Tauri, Rust, commands.rs, judge.rs, db.rs, migrations, capabilities, seed scripts, and packs code in this repo backend.
---

# Backend conventions

This file covers `src-tauri/` only. It does not cover `src/` frontend code. Verify every claim against the files named below before changing code.

## Where backend code lives

* `src-tauri/Cargo.toml`: package `airlock`, currently `1.4.0`, edition 2021. Dependencies are `tauri` v2, `serde` with derive, `serde_json`, `rusqlite` 0.31 with `bundled`, `uuid` with `v4` and `serde`, `wait-timeout` 0.2, `chrono` with `serde`, `tempfile` 3, `tauri-plugin-updater` 2, `tauri-plugin-process` 2. Feature `custom-protocol` maps to `tauri/custom-protocol`.
* `src-tauri/build.rs`: calls `tauri_build::build()` only.
* `src-tauri/src/main.rs`: module declarations, Tauri builder setup, DB path resolution and legacy migration, `AppState` install, `invoke_handler` registration, plugin registration.
* `src-tauri/src/commands.rs`: all 32 Tauri commands plus `AppState`, `load_tests_for_judge`, `sample_problems_json`, `PackTechnique`, `PackImportSummary`.
* `src-tauri/src/db.rs`: `init` with schema and guarded migrations, all SQL helpers, rank seed, unit tests on `:memory:` DB.
* `src-tauri/src/judge.rs`: compile, run, timeout, diff, stress test, unit tests.
* `src-tauri/src/models.rs`: serializable structs and enums shared with frontend JSON and Python scripts.
* `src-tauri/tauri.conf.json`: product, window, bundle, updater config.
* `src-tauri/capabilities/main.json`: permission allowlist for the `main` window.
* `scripts/seed_problems.py`, `scripts/import_pack.py`, `scripts/export_pack.py`: offline DB tools. `scripts/ship.sh` is release plumbing, not DB logic.
* `sample-problems/*.json`: 15 starter problems, compile time source of truth.
* `packs/<name>/pack.json` plus problem JSON copies: shareable packs.
* `seeds/`: legacy seed artifacts, not used by current commands.

## Tauri command rules

* Put each feature slice in `src-tauri/src/commands.rs` as its own `#[tauri::command]`.
* Register every new command in `src-tauri/src/main.rs` in `tauri::generate_handler![...]`. The app fails at runtime if a frontend call has no registered handler.
* The current handler list has 32 entries: `list_problems`, `save_problem`, `update_problem_notes`, `submit_solution`, `run_solution`, `create_contest`, `run_stress_test`, `list_submissions`, `list_submissions_by_problem`, `list_contests`, `clear_submissions`, `clear_all_data`, `upsert_claim`, `list_claims`, `set_contest_driver`, `list_techniques`, `save_technique`, `update_technique_status`, `update_technique_notes`, `bulk_update_technique_status`, `classify_submission`, `touch_technique`, `list_due_reimplementations`, `list_rank_themes`, `create_rank_theme`, `set_active_theme`, `get_rank_state`, `check_rank_suggestion`, `confirm_rank_up`, `list_rank_reflections`, `seed_sample_problems`, `import_pack`.
* Every command that touches the DB takes `state: State<AppState>` first and locks with `state.conn.lock().map_err(|e| e.to_string())?`. The single exception is `run_stress_test`, which takes no `State` because it only calls `judge::run_stress_test`.
* Return `Result<T, String>`. Map rusqlite and serde errors with `.map_err(|e| e.to_string())?`.
* Generate ids server side with `Uuid::new_v4().to_string()` when the input id is empty. This applies to problems, test cases, contests, techniques, rank themes, rank reflections, and submissions. Never trust a blank id from the caller.
* Validate at the command boundary. Examples in code: `save_technique` rejects blank names, `create_rank_theme` requires exactly 8 `tier_names` and 8 `tier_colors` plus a nonblank `system_name`, `confirm_rank_up` requires `1 <= star_level <= 7` and `star_level == current_stars + 1`, `import_pack` rejects problems with blank titles or zero tests, `update_technique_status` and `touch_technique` return `technique not found` when `updated == 0`, `classify_submission` returns `no recent non-AC submission to classify` when `updated == 0`, `set_contest_driver` returns `contest not found` for unknown ids.
* Keep `submit_solution` and `run_solution` semantics distinct. `submit_solution` judges, inserts a `Submission` with `Utc::now().to_rfc3339()`, and calls `record_ac_for_reimplementation` on `Accepted`. `run_solution` judges and logs nothing.
* Keep `import_pack` behavior aligned with `scripts/import_pack.py`. Techniques upsert gently by id. Existing local technique rows keep status and notes and count as `kept`. New ones insert with `NotStarted`, current timestamp, null notes. Problems use insert or replace with fresh UUIDs for blank ids.
* Keep `seed_sample_problems` as top up by title. It skips any bundled problem whose title already exists, so older vaults heal to the full set without duplicates or wipes.
* Never call `invoke` from a new place. Frontend access goes through `src/lib/api.ts` only.

## Database rules

* `AppState` in `src-tauri/src/commands.rs` is `pub struct AppState { pub conn: Mutex<Connection> }`. `src-tauri/src/main.rs` creates one `Connection` in `setup` and installs it with `app.manage`.
* `db::init(&db_path)` in `src-tauri/src/db.rs` opens the connection, runs one `execute_batch` with `CREATE TABLE IF NOT EXISTS` for all 10 tables, then guarded `ALTER TABLE` adds, then `seed_rank_tables`.
* Tables created in `init`: `problems`, `test_cases`, `submissions`, `contests`, `problem_claims`, `techniques`, `reimplementation_schedule`, `rank_themes`, `rank_state`, `rank_reflections`.
* Migration rule for new work. New tables use `CREATE TABLE IF NOT EXISTS` inside the batch. New columns use `let _ = conn.execute("ALTER TABLE ... ADD COLUMN ...", [])`. The `let _ =` ignores the error when the column already exists, so existing installs never break. Current guarded columns: `problems.notes_md`, `problems.primary_technique_id`, `problems.hints`, `submissions.failure_category`, `submissions.hints_revealed`, `contests.team_members`, `contests.driver`.
* JSON columns store text. `problems.tags`, `problems.hints`, `contests.problem_ids`, `contests.team_members`, `submissions.context`, `rank_themes.tier_names`, `rank_themes.tier_colors`, `rank_state.achieved_at` are serialized with `serde_json::to_string` on write and `serde_json::from_str` with `unwrap_or_default` on read.
* Enum columns store short strings. Verdicts are `AC`, `WA`, `TLE`, `RE`, `CE`. Technique status values are `NotStarted`, `Learning`, `Assimilated`, `Rusty`. Failure categories are `Conceptual`, `Implementation`, `StlGap`, `Indexing`, `Careless`, `MisreadStatement`, `PrematureTechnique`.
* Read optional columns defensively with `row.get(n).ok().flatten()`. Examples: `list_problems` reads `hints` at index 12 and `primary_technique_id` at index 11 this way, `list_submissions` and `list_submissions_by_problem` read `failure_category` and `hints_revealed` this way, `list_contests` parses optional `team_members` JSON this way. New optional columns must follow the same pattern.
* `list_problems` returns problems with empty `tests`. Callers that need tests call `db::get_tests` per problem, as `commands::list_problems` does. The `db.rs` round trip test asserts this split.
* `insert_problem` is replace plus test resync. It runs `INSERT OR REPLACE INTO problems`, then `DELETE FROM test_cases WHERE problem_id`, then reinserts tests.
* `classify_latest_submission` tags only the newest non AC row for a problem with `ORDER BY submitted_at DESC LIMIT 1` and `verdict != 'AC'`.
* `record_ac_for_reimplementation` intervals are fixed. First AC inserts with `completed_reimplementations = 0` due in 1 day. Next AC sets count to 1 due in 3 days. Later ACs increment and stay at 7 days. The `db.rs` test asserts count 2 after three calls.
* `rank_state` is a singleton row with `id = 1`, default `theme_id = 'default'`, `current_stars = 0`, `achieved_at = '{}'`, null pending. `get_rank_state` self heals by reseeding when the row is missing.
* `seed_rank_tables` inserts the `default` theme named `Airlock Standard` with 8 tier names and 8 hex colors only when `rank_themes` is empty, and inserts the rank state row only when `rank_state` is empty.
* `check_rank_suggestion` formula in `src-tauri/src/commands.rs` is `readiness = 0.6 * technique_readiness + 0.4 * contest_signal`, where `technique_readiness` is assimilated fraction and `contest_signal` is `min(1, non-upsolve Contest AC count / 5)`. It suggests `current + 1` capped at 7 when `readiness >= 0.15 * next`, except tiers 5 to 7 also require at least one non-upsolve Contest AC. It never increments `current_stars` itself.
* `clear_all_data` deletes only `submissions` and `contests`. It leaves problems, techniques, rank data, claims, and schedules in place.
* DB file location is resolved in `src-tauri/src/main.rs` with `app.path().app_data_dir().join("airlock.sqlite")`. On Linux this is `~/.local/share/com.silvestre.airlock/airlock.sqlite`. Migration copies in order when the new file does not exist: `com.silvestre.cptrainer/cp-trainer.sqlite`, then `com.silvestre.cptrainer/airlock.sqlite`, then legacy `airlock.sqlite` directory file named `cp-trainer.sqlite`.

## Judge rules

* All logic lives in `src-tauri/src/judge.rs`. Entry points are `run_judge` and `run_stress_test`.
* Supported languages are exactly `cpp` or `c++` and `java`. Anything else returns `unsupported language`.
* C++ compiles with `g++ -O2 -std=c++17 -o <BIN> main.cpp`. Java writes `Main.java`, compiles with `javac` in the temp dir, runs with `java -cp <dir> Main`, so the public class must be named `Main`.
* Each compile and run uses its own `tempfile::TempDir`. `CompiledArtifact` holds `run_cmd`, `run_args`, optional `compile_error`, and `_workdir: TempDir`. The underscore field is load bearing. It keeps the directory alive until the run finishes. Do not remove it.
* Console windows stay hidden on Windows. All spawns go through `silent_command`, which sets `CREATE_NO_WINDOW = 0x0800_0000` on Windows and plain `Command::new` elsewhere. New process spawns must use this helper.
* Per test timeout uses the `wait-timeout` crate. `run_one_test` and `run_capture_stdin` call `child.wait_timeout(Duration::from_millis(time_limit_ms))`, then `kill` and `wait` on `None`. Timeout yields `TimeLimitExceeded` in `run_one_test` and empty output in stress capture.
* Output comparison uses `normalize`, which trims trailing whitespace per line and strips trailing blank lines. Inner spacing stays significant. `truncate` caps stderr at 2000 chars with `... [truncated]`.
* `run_judge` short circuits compile errors into a single `compile` test result with `overall_verdict = CompileError`. Otherwise it runs every test, counts passes, and sets overall to the first non AC verdict.
* `run_stress_test` compiles generator, candidate, and brute force with the same language, then loops `seed` in `0..max_cases`. Generator input is `run_capture` with the seed as argv. Candidate and brute outputs use `run_capture_stdin` with the same timeout. First normalized mismatch returns `Some((input, candidate_output, brute_output))`, else `None`.
* Stdin writes use `let _ = stdin.write_all(...)` after `child.stdin.take()`. Keep this ignore pattern so a fast exiting child cannot fail the judge.

## Models and data shapes

* Canonical shapes live in `src-tauri/src/models.rs`: `Problem`, `TestCase`, `Verdict`, `TestResult`, `JudgeReport`, `Submission`, `SubmissionContext`, `Contest`, `ProblemClaim`, `Technique`, `TechniqueStatus`, `ReimplementationSchedule`, `RankTheme`, `RankState`, `RankReflection`, `FailureCategory`.
* `Problem` fields: `id`, `title`, `statement_md`, `tags`, `difficulty` as `i32`, `time_limit_ms` and `memory_limit_mb` as `u64`, `source`, `tests`, optional `brute_force_src`, `brute_force_lang`, `notes_md`, `primary_technique_id` with serde default, `hints` with serde default.
* `Submission` fields: `id`, `problem_id`, `language`, `source_code`, `verdict`, `submitted_at` ISO 8601, `context`, optional `failure_category` and `hints_revealed` with serde defaults.
* `Contest` has `penalty_minutes` default 20 at creation, `team_members` default empty, optional `started_at` and `driver`.
* `RankTheme` requires exactly 8 `tier_names` and 8 `tier_colors`. `RankState.achieved_at` uses string keys `"1"` to `"7"` to ISO dates.
* JSON files use the same field names. Optional fields may be absent, null, or empty. Rust structs use `#[serde(default)]` for `primary_technique_id`, `hints`, `failure_category`, `hints_revealed`, `team_members`, `achieved_at`, and `pending_suggestion`.

## Capabilities and permissions

* File is `src-tauri/capabilities/main.json` with `identifier main`, `local true`, `windows ["main"]`.
* `core:app:allow-version` supports any version display.
* `updater:default`, `updater:allow-check`, `updater:allow-download-and-install` support the silent updater configured in `tauri.conf.json`. The updater plugin is registered in `main.rs` with `tauri_plugin_updater::Builder::new().build()`.
* `process:default` and `process:allow-restart` support updater relaunch. The process plugin is registered with `tauri_plugin_process::init()`.
* `core:window:allow-minimize`, `allow-maximize`, `allow-unmaximize`, `allow-is-maximized`, `allow-toggle-maximize`, `allow-close`, `allow-start-dragging` support the custom chrome. `tauri.conf.json` sets `decorations false`, so these are the only window controls available.
* Add a permission only with a code path that needs it. Keep `windows` scoped to `main` unless a second window exists.

## App config and versioning

* `src-tauri/tauri.conf.json` keys that matter: `productName Airlock`, `identifier com.silvestre.airlock`, `build.beforeDevCommand npm run dev`, `build.beforeBuildCommand npm run build`, `devUrl http://localhost:1420`, `frontendDist ../dist`, single `app.windows` entry labeled `main` sized 1280 by 800 with min 960 by 600, centered, shadowed, resizable, `decorations false`, `security.csp null`, `bundle.active true`, `targets all`, category `Education`, `createUpdaterArtifacts true`, Windows NSIS English only, `plugins.updater.active true`, `dialog false`, pinned `pubkey`, endpoint `https://github.com/SilesterGold9/airlock/releases/latest/download/latest.json`.
* Version triple must move together: `package.json` version, `src-tauri/Cargo.toml` version, `src-tauri/tauri.conf.json` version. All three read `1.4.0` at the time of writing.
* Release flow from `CONTRIBUTING.md` and `scripts/ship.sh`: work on `dev`, one commit per issue as `type: short description (#NN)`, `npm run ship` merges `dev` to `main` fast forward only and refuses on a dirty tree, then bump the triple plus a `src/lib/changelog.ts` entry, then `git tag vX.Y.Z && git push origin main vX.Y.Z`. The tag opens a draft release. Installed apps update only after the draft is published because GitHub latest ignores drafts.
* Updater signing is one time. `npm run tauri signer generate -w ~/.tauri/airlock.key` prints the public key for `plugins.updater.pubkey` and writes the private key for repo secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Unsigned bundles are rejected by the in app updater.
* Do not add dependencies without issue discussion.

## Python script contracts

* `scripts/seed_problems.py <db_path>`: reads every `sample-problems/*.json`, uses `data["id"] or uuid4` and `t["id"] or uuid4`, writes `problems` with `INSERT OR REPLACE` plus `DELETE` and reinsert of `test_cases`, commits once. It expects the schema to already exist.
* `scripts/import_pack.py <pack_dir> <db_path>`: requires `<pack_dir>/pack.json` with `pack_name`, `techniques` as `[{id, name}]`, and `problem_files`. Techniques keep local rows when the id exists, else insert with `NotStarted`, fresh UTC timestamp, null notes. Problems mirror the seed script. It warns when `primary_technique_id` is not listed in the manifest.
* `scripts/export_pack.py <db_path> <out_dir> --name "Name"`: writes one JSON file per problem plus `pack.json` with sorted `problem_files`. Problem allowlist is `id`, `title`, `statement_md`, `tags`, `difficulty`, `time_limit_ms`, `memory_limit_mb`, `source`, `tests` with `id`, `input`, `expected_output`, `brute_force_src`, `brute_force_lang`, `hints`, `primary_technique_id`. Technique allowlist is `id` and `name` only. Never exported: `problems.notes_md`, all of `submissions`, `contests`, `reimplementation_schedule`, `problem_claims`, `techniques.status`, `status_updated_at`, `notes_md`. Missing tables are treated as empty.
* CI compile checks all three scripts with `python3 -m py_compile`. Keep them compiling under the system Python.

## Packs and sample problem contracts

* `sample-problems/*.json` files use blank ids (`"id": ""` and test `"id": ""`), require `title`, `statement_md`, `tags`, `difficulty`, `time_limit_ms`, `memory_limit_mb`, `source`, `tests` with `input` and `expected_output`, and nullable `brute_force_src` and `brute_force_lang`. Older files omit `notes_md`, `primary_technique_id`, and `hints`, which is valid because the Rust struct supplies serde defaults.
* `packs/<name>/pack.json` shape is `{"pack_name": str, "techniques": [{"id": str, "name": str}], "problem_files": [filenames]}`. Pack problem files use stable ids such as `"ab-sum"` and test ids such as `"ab-sum-1"`, and usually include `primary_technique_id` and `hints`.
* `packs/` holds full problem file copies, not manifests alone. `packs/starter-vault/` mirrors the 15 sample problems with stable ids. `packs/week-1-implementation/` holds 2 problems and 2 techniques.
* `commands::sample_problems_json` embeds the 15 sample files with explicit `include_str!("../../sample-problems/<name>.json")` entries. The comment says the repo files are the single source of truth. Adding or removing a sample file requires editing that `FILES` array, or the binary and the directory drift apart.

## Verification commands

* Local Rust uses the pinned toolchain binary because the plain `cargo` shim is broken in some environments:
  `export RUSTUP_OFFLINE=true`
  `~/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/cargo check --offline`
  `~/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/cargo test --offline`
  `~/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/cargo fmt --check`
* CI in `.github/workflows/ci.yml` differs on purpose. It installs stable with `dtolnay/rust-toolchain@stable` and system webkit deps, then runs `cargo check --locked`, `cargo test --locked`, and `cargo fmt --check` from `src-tauri/`, plus `npm install`, `npm test`, `npm run build`, and `py_compile` of the three scripts. Keep all of these green and run `cargo fmt` before pushing Rust changes.
* Rust tests need no services. `db.rs` tests use `:memory:` connections, `judge.rs` tests shell out to local `g++`.
