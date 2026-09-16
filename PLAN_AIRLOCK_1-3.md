# Plan to implement Airlock roadmap items 1 to 3

Companion to `ROADMAP_AIRLOCK.md` and `README.md:86`. This covers the top three items you prioritized for Oct 15 in Luanda, built on the codebase at `main:d1f4d1f` which already has `v0.4.0` with stress lab, import, and history.

Items are 1 Problem notes, 2 Partial scoring, 3 Upsolving. Each is a vertical slice you can ship alone. Team mode and Portuguese localization are intentionally after these because they are larger or additive.

## Principles for these three

* Ship the smallest thing that still feels complete. Each slice ends with a working route you can click, not a half done abstraction.
* One deep interface per slice. Notes has `update_problem_notes`, partial scoring has `JudgeReport` with counts, upsolving has `SubmissionContext::Contest { upsolve }`. Hide the rest.
* Reuse what exists. `Practice.tsx`, `Contest.tsx`, `SplitView`, `Card`, `Badge`, `VerdictBadge`, `Textarea` and the `submissions` table already log everything. No new colors or radius, only `border-border` and `bg-card`.
* Do not mix concerns. Partial scoring is a Practice display change, not a contest scoring change. Upsolving is a flag, not a new table.
* Keep persistence cheap. Notes debounce in the frontend, one Tauri command, no new table.

## Item 1 — Problem notes

### Current state

`Problem` in `src-tauri/src/models.rs:11` has `id`, `title`, `statement_md`, `tags`, `difficulty`, `tests`, `brute_force_src`. No field for personal notes. `src-tauri/src/db.rs:5` `problems` table mirrors that shape, `insert_problem` and `list_problems` read and write the whole row. `Practice.tsx:92` shows the statement and the editor, but nowhere to write your own editorial. You already teach by having juniors write explanations, this is the same for you.

### Design

Add `notes_md: Option<String>` to `Problem`. It lives on the problem row because notes are per problem, not per submission. The content is markdown, same as `statement_md`, so you can reuse the existing `pre` rendering.

Frontend is a collapsible `My notes` panel under the statement in `Practice.tsx`. It is a `Textarea` with an autosave indicator. Typing does not hit Tauri on every keystroke. The panel debounces 800 to 1000 ms after typing stops, then calls one command.

Backend has one new command, cheaper than round tripping the whole problem.

```rust
#[tauri::command]
pub fn update_problem_notes(state: State<AppState>, problem_id: String, notes_md: String) -> Result<(), String>
```

It does `UPDATE problems SET notes_md = ? WHERE id = ?`. No new table, no new migration beyond adding the column with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` or recreating via `CREATE TABLE IF NOT EXISTS` with the new column. Use the second pattern to keep `db.rs:5` `init` idempotent.

### File changes

* `src-tauri/src/models.rs:11` add `pub notes_md: Option<String>` to `Problem`.
* `src-tauri/src/db.rs:5` add `notes_md TEXT` to `CREATE TABLE problems`, update `insert_problem` to include it, update `list_problems` to read it, add `update_problem_notes`.
* `src-tauri/src/commands.rs:24` add `update_problem_notes`, register it in `src-tauri/src/main.rs:28` `invoke_handler`.
* `src/lib/api.ts:6` add `updateProblemNotes(problemId, notesMd)`.
* `src/lib/types.ts:14` add `notes_md?: string | null` to `Problem`.
* `src/pages/Practice.tsx:92` add a `My notes` `Card` under the statement. State `notes` initialized from `selected.notes_md`, `useEffect` to sync when switching problems, debounced `useEffect` to call `api.updateProblemNotes`.
* `sample-problems/*.json` add `"notes_md": null` so the seed script still works. `scripts/seed_problems.py:32` already reads `data.get(...)` for optional fields, add one line for `notes_md`.

### Steps

1. Add the field to `models.rs` and the column to `db.rs`. Run `cargo check` in `src-tauri` and verify `list_problems` returns `None` for old rows.
2. Add the command and register it. Test from the frontend console with `invoke("update_problem_notes", { problemId, notesMd: "hello" })`.
3. Build `Practice.tsx` panel: `Textarea` with `min-h-[120px]` `font-sans`, placeholder `Write your approach after solving...`, saved indicator `Saved` or `Saving...`, error toast if invoke fails. Debounce with `setTimeout` 900 ms, cleanup on unmount.
4. Seed a note via JSON import to verify persistence across reloads.

### Testing

* Rust: insert a problem with `notes_md = Some("my editorial")`, `list_problems` returns it, update to `None` and back.
* Frontend: type, wait 1 s, reload, note is still there. Switch problems, notes swap correctly.

### Risks

Old DB rows have no `notes_md` column until `init` runs again. The `CREATE TABLE IF NOT EXISTS` will not add the column to an existing table. Use `ALTER TABLE problems ADD COLUMN notes_md TEXT` inside `init` with `IF NOT EXISTS` guard, or run a one time migration. Keep the write small.

## Item 2 — Partial scoring

### Current state

`judge.rs:21` `run_judge` compiles, then loops tests. On first non AC it sets `overall` to that verdict, pushes the result, then `break`. `JudgeReport` in `src-tauri/src/models.rs:45` has only `overall_verdict` and `results` with the passing tests plus the one failing. `Practice.tsx:156` shows `Stopped at test N of total` and `Contest.tsx:241` the same. This matches a pass fail judge.

HackerRank style partial scoring needs `tests_passed` over `total` instead of early exit. The judge already has the data if it keeps running.

### Design

Change `run_judge` to run all tests. Keep the early exit for contest mode if you want, but for this slice make practice mode show all. The simplest is to remove the `break` and let `results` contain every test with its verdict. Then `overall_verdict` is still `Accepted` only if all are `Accepted`, otherwise the first failing verdict, but `results` now has the full picture.

Add two fields to `JudgeReport`.

```rust
pub struct JudgeReport {
    pub overall_verdict: Verdict,
    pub results: Vec<TestResult>,
    pub tests_passed: u32,
    pub tests_total: u32,
}
```

In `run_judge` increment `tests_passed` when `result.verdict == Accepted`, after the loop fill the two counts. No new table, no new command.

Frontend shows `7/10 tests passed` next to the overall badge in Practice. Contest keeps the existing ICPC penalty display and does not use the new counts for scoring, it stays AC or not AC, as you noted ICPC does not give partial credit.

### File changes

* `src-tauri/src/models.rs:45` add `tests_passed` and `tests_total` to `JudgeReport`.
* `src-tauri/src/judge.rs:46` remove the `if !matches!(overall, Accepted) { break; }`, accumulate `tests_passed`, set the two fields in the returned report. Keep `overall` as before.
* `src/lib/types.ts:36` add the two fields to `JudgeReport`.
* `src/pages/Practice.tsx:156` replace `Stopped at test` with `tests_passed/tests_total` when the report has the fields, keep the detailed per test `details` list. The list will now be longer for partial, so keep `max-h-[420px]` scroll.
* `src/pages/Contest.tsx:241` no change for scoring, just keep the same display or show `tests_passed/total` as secondary info, not as penalty input.

### Steps

1. Edit `judge.rs` to remove the break and add the counts. Run `cargo check` and a quick manual `run_judge` with 10 tests where 7 pass, verify `overall_verdict` is `WrongAnswer` but `tests_passed` is 7.
2. Update `models.rs` and `types.ts`, rebuild frontend, verify `Practice.tsx` renders `7/10` with the same per test details. The existing `VerdictBadge` and `SplitView` stay.
3. Confirm contest mode still uses `overall_verdict === Accepted` only for the scoreboard, not the new counts.

### Testing

* Rust: 10 tests, 3 WA, assert `tests_passed == 7`, `tests_total == 10`, `results.len() == 10`.
* Frontend: submit a solution that passes 1 of 3 sample tests, see `1/3 tests passed` and all three `details` expanded for the failing ones.

### Risks

Running all tests costs time, but `time_limit_ms` is per test, not total, so worst case is `total * limit`. For 50 tests at 1000 ms it is 50 s. Keep the current per test timeout, and consider a global cap later if needed. For now it is fine for practice, tests are few.

## Item 3 — Upsolving

### Current state

`SubmissionContext` in `src-tauri/src/models.rs:62` is `Practice` or `Contest { contest_id: String }`. `Contest.tsx:68` creates a submission with `Contest { contest_id: "current" }` while the contest is live, and disables submit when `ended` is true. After the timer expires there is no way to keep submitting against those problems without it counting as a live contest attempt. Codeforces style upsolving needs a separate flag.

`submissions` table already stores `context` as JSON, so no schema change is needed beyond adding a bool inside that JSON. Stats views filter `submissions` but currently do not distinguish upsolve.

### Design

Add `upsolve: bool` to the `Contest` variant.

```rust
pub enum SubmissionContext {
    Practice,
    Contest { contest_id: String, upsolve: bool },
}
```

In `Contest.tsx` when `ended` is true, keep the submit button enabled but pass `upsolve: true`. The UI shows an `upsolving` label instead of the live scoreboard, and the `statuses` penalty logic does not increment `wrongAttempts` for upsolve, or it does but the history view filters it out of contest performance.

The history page you shipped in `v0.4.0` `src/pages/History.tsx:50` already filters by tag and verdict. Add a toggle `include upsolve` default false, so contest performance charts count only `upsolve == false`.

### File changes

* `src-tauri/src/models.rs:62` add `upsolve: bool` to `Contest`.
* `src-tauri/src/db.rs` no schema change, `context` is JSON text, but update `list_submissions` deserialization to handle the new shape. Old rows with `{"Contest":{"contest_id":"current"}}` will deserialize with missing `upsolve`, use `#[serde(default)]` on the field to default to `false`.
* `src/lib/types.ts:43` add `upsolve?: boolean` or required `boolean` with default handling.
* `src/pages/Contest.tsx:68` keep submit enabled when `ended`, pass `upsolve: ended`, show a badge `Upsolving` where the live scoreboard was, and do not update `statuses` penalty for upsolve, or update but mark.
* `src/pages/History.tsx:50` add a checkbox `Include upsolve` that when off filters out `s.context.Contest?.upsolve === true`.

### Steps

1. Add the field to `models.rs` with `#[serde(default)]` so old DB rows still load. Run `cargo check` and verify `list_submissions` returns old rows with `upsolve == false`.
2. Update `Contest.tsx` to keep the button enabled after `ended`, pass `upsolve: true`, and show `Upsolving — submissions do not affect live score` under the timer. The existing `Timer` stays.
3. Update `History.tsx` filter to exclude upsolve by default, add a toggle, and show a small `upsolve` tag in the table when the flag is true.

### Testing

* Rust: insert a `Contest { contest_id: "x", upsolve: true }` and a `Practice`, list both, verify the flag round trips.
* Frontend: run a contest, let it expire, submit, see the row in History with `upsolve` and that the contest scoreboard does not increase.

### Risks

Old rows without `upsolve` must not break. Using `default` handles it. Do not add a new table, the JSON field is enough for v0.5.0.

## Cross cutting

* Each item is one route or one flag, no shared new store. Notes touches `Problem`, partial scoring touches `JudgeReport`, upsolving touches `SubmissionContext`. They do not overlap.
* Reuse `Card`, `Textarea`, `Badge`, `VerdictBadge`, `SplitView` from `src/components/ui`. No new colors, only `border-border` and `bg-card`.
* Keep Tauri commands small and named exactly as the doc says: `update_problem_notes` is cheaper than reusing `save_problem` for every keystroke.
* Debounce notes, do not hit SQLite on every key.

## Delivery order

Week 1 notes, 1 to 2 days. Week 2 partial scoring, half day. Week 3 upsolving, 1 day. This matches the Milestones `v0.2.0` to `v0.4.0` you already have, but now those are shipped, so treat these as `v0.5.0` notes, `v0.6.0` partial scoring, `v0.7.0` upsolving before `v1.0.0` polish on Oct 15. The doc says build top to bottom, and Portuguese localization can slot anywhere, it is additive.

## Checklist

* [ ] Notes: `models.rs` `notes_md`, `db.rs` column and `update_problem_notes`, `commands.rs` and `main.rs` registration, `api.ts` and `types.ts`, `Practice.tsx` `My notes` panel with debounce.
* [ ] Partial: `models.rs` counts, `judge.rs` remove break, `types.ts` and `Practice.tsx` `7/10` display.
* [ ] Upsolving: `models.rs` `upsolve`, `Contest.tsx` keep enabled after ended, `History.tsx` filter toggle.
* [ ] For each, `npm run build` and `cargo check`, then `npm run tauri dev` and one manual submit per verdict.

This keeps the next three increments small, tied to the files you already have, and ready for team mode after they are solid.
