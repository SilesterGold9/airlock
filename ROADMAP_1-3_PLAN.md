# Plan to implement roadmap items 1 to 3

This covers the three highest priority items from `README.md:86` for the Oct 15 deadline. It is grounded in the actual files in this repo at `main:e8d290b` and proposes the smallest set of changes that give you a shippable vertical slice for each item.

## Current codebase snapshot

* **Rust judge** `src-tauri/src/judge.rs:21` `run_judge` compiles C++ with `g++ -O2 -std=c++17` or Java with `javac`, runs each test with `wait_timeout`, normalizes output, returns `JudgeReport`. `src-tauri/src/judge.rs:218` `run_stress_test` already takes `candidate_src`, `brute_force_src`, `generator_src` as programs, compiles each with `compile_source`, then loops `seed 0..max_cases` and compares `normalize(candidate)` vs `normalize(brute)`. It returns `Some(input, cand_out, brute_out)` on first mismatch.
* **DB** `src-tauri/src/db.rs:5` `init` creates `problems`, `test_cases`, `submissions`, `contests`. `insert_problem` and `insert_submission` exist. `list_problems` returns problems without tests, `get_tests` fills them. There is no `list_submissions` or `list_submissions_by_problem`. Verdicts are stored as strings `AC/WA/TLE/RE/CE` via `verdict_to_str`.
* **Commands** `src-tauri/src/commands.rs:14` exposes `list_problems`, `save_problem`, `submit_solution`, `create_contest`, `run_stress_test`. `submit_solution` already logs a `Submission` with `SubmissionContext::Practice` or `Contest`. No command to read submissions back.
* **Frontend api** `src/lib/api.ts:4` wraps those five invokes. `src/lib/types.ts:8` defines `Problem` with `tests: TestCase[]` plus optional `brute_force_src`, `Submission` is defined but never read.
* **UI** `src/App.tsx:8` has nav `Practice` and `Contest`. `src/pages/Practice.tsx:1` and `Contest.tsx:1` both have a 50 percent split with `SplitView`, `CodeEditor` (`src/components/CodeEditor.tsx:10` templates), `VerdictBadge` and `src/lib/verdict.ts:1` human readable mapping. Design tokens are now LeetCode-inspired `tailwind.config.js:1` and `src/index.css:1` with `hsl(var(--background))` etc.
* **Seeding** `scripts/seed_problems.py:12` reads `sample-problems/*.json` and inserts. `Problem` JSON shape is the same as `src-tauri/src/models.rs:11`.

Efficient coding stance for this plan: ship the smallest thing that still feels complete, hide the new complexity behind one well-chosen interface per item, reuse the existing primitives instead of inventing new ones, and keep each slice testable from Rust unit level up to Tauri invoke level before adding UI polish.

## Item 1 — Stress test UI page

### Why it is first

Backend already works. The UI is the only missing piece, and it teaches the core ICPC skill of fuzzing against a brute force. It also unblocks item 2, because a good import flow can include an optional brute force.

### Current gap

No page, no route, no editor layout for the three programs. `run_stress_test` expects the generator to be a program that takes a single seed string and prints a test case. That contract is not documented in the UI and not typed. The candidate and brute force are expected to be full programs that read from stdin.

### Design

**Route** `HashRouter` in `src/main.tsx:3` already uses `#/`. Add `/stress` route in `src/App.tsx:30`. Add nav item `Stress`.

**Data flow**
1. User picks a problem from a dropdown or reuses the currently selected problem in Practice. The page loads `problem.brute_force_src` if present, otherwise empty.
2. Three editors share the same `language` state (`cpp` | `java`) via one selector. Changing language resets only empty editors, same behavior as `CodeEditor.tsx:48`.
3. Inputs: `maxCases` default 100, `timeLimit` default 1000ms.
4. Click Run calls `api.runStressTest` `src/lib/api.ts:29`. While running show `Judging...` and disable button. On `Err`, show the string as a compilation failure. On `Ok(None)`, show success. On `Ok(Some(input, candidate, brute))`, show the failing input and a two column diff.

**UI layout, reuse existing primitives**

Use `SplitView` for the three editors: left `candidate`, middle `brute`, right `generator`. LeetCode density suggests each editor gets a `Card` header `h-10` with a label and `Badge` for language. Below editors, a `Card` for controls with `Button` primary `Run stress test`. Result area is another `Card` with `VerdictBadge` and two `pre` blocks side by side. No new design needed.

**File changes**

* `src-tauri/src/judge.rs` no change. The function is already correct, just add doc comment clarifying generator contract.
* `src-tauri/src/commands.rs` no change. The existing `run_stress_test` command is sufficient. Consider adding a thin wrapper that also returns compile errors in a structured way, but the current `Result<Option<[String;3]>, String>` already surfaces generator or candidate compile failure as `Err`.
* `src/pages/Stress.tsx` new file, about 180 lines. Handles state, calls `api.runStressTest`, renders editors and result.
* `src/App.tsx` add route and nav.
* `src/lib/types.ts` no change. Already has `Problem.brute_force_src`.

**Step by step**

1. Create `src/pages/Stress.tsx` with three `CodeEditor` instances. Share `language`. For quick validation, paste the max subarray brute force (O n squared) and a generator that emits `n` and `n` numbers. Keep the page isolated so it does not touch `Practice` state.
2. Add route `String` `stress` in `src/App.tsx:30` and nav entry. Test navigation, verify `SplitView` persists via `storageKey="stress-split"`.
3. Wire the Run button to `api.runStressTest`. Handle the three outcomes: `Err` shows `CompileError` with the message in a `pre`, `Ok(None)` shows `Accepted` with "No mismatches in N cases", `Ok(Some(...))` shows `WrongAnswer` with the three strings.
4. Add problem picker: `api.listProblems` dropdown that fills `brute_force_src` from `problem.brute_force_src` when a problem is selected. Keep it optional so the page also works without a problem.
5. Add input validation: `maxCases` 1 to 10000, `timeLimit` 100 to 10000. Guard empty editors before invoke.
6. Polish: copy buttons for the failing input, collapse editors on mobile with tabs, add `animate-fade-in`.

**Testing**

* Rust level: the existing `run_stress_test` can be unit tested with two small C++ programs. Add a `#[cfg(test)]` in `judge.rs` that feeds a correct candidate vs brute on a known max subarray. Verify `normalize` still handles trailing spaces.
* Tauri level: call `cargo test` for the three compile error branches.
* Frontend level: mock `api.runStressTest` to return each of the three outcomes and check rendering. No need for full e2e yet.

**Risks**

Generator contract is subtle. The backend calls `run_capture` with `seed` as a single arg. If the generator ignores `arg` and uses `rand`, the fuzz is still random but not deterministic. Document it in the UI placeholder: `int main(int argc, char** argv) { int seed = atoi(argv[1]); srand(seed); ... }`.

## Item 2 — Problem import screen

### Current gap

Only two paths to add problems: hand editing SQLite or `scripts/seed_problems.py` plus `save_problem` command which is never called from the UI. No validation, no duplicate check, no feedback.

### Design

**Route** `/import`. Two modes: `Form` and `JSON paste`. Both produce a `Problem` and call `api.saveProblem`.

**Form mode** Fields map one to one to `src-tauri/src/models.rs:11` and `sample-problems/ab-sum.json:1`: `title`, `statement_md` textarea, `tags` comma separated, `difficulty` number, `time_limit_ms`, `memory_limit_mb`, `source` string, `tests` dynamic list with `input` and `expected_output` textarea per test, plus optional `brute_force_src` and `brute_force_lang`. Use `Card` per section and `Badge` for tags preview.

**JSON paste mode** Big textarea with a template prefilled from `ab-sum.json`. On paste, `JSON.parse`, validate required fields, show errors inline, then call `saveProblem`. Offer a `Download sample JSON` button.

**Validation** Reuse the seed script logic. Required: `title` non empty, at least one test, each test has input and expected. `difficulty` 0 to 3500, `time_limit_ms` positive, `tags` array. If `brute_force_src` set then `brute_force_lang` required. Duplicate title check is a warning, not an error.

**File changes**

* `src-tauri/src/commands.rs` no change. `save_problem` already does `Uuid::new_v4` if `id` empty and inserts tests.
* `src/lib/api.ts` no change. `saveProblem` already exists.
* `src/pages/Import.tsx` new file, about 220 lines. Handles form state, validation, and JSON mode.
* `src/App.tsx` add route and nav.

**Step by step**

1. Scaffold `Import.tsx` with a tab `Form | JSON`. Start with form, uncontrolled inputs, collect into a `Problem` on submit. Reuse `DifficultyBadge` for preview.
2. Add JSON mode: textarea with default `JSON.stringify(sample, null, 2)` where sample is `ab-sum.json` shape. Parse on submit, map errors to field.
3. Call `api.saveProblem` and show `VerdictBadge` style success with `Problem` id, plus a `View in Practice` link that sets the selected problem via query param or localStorage. Invalidate `listProblems` cache.
4. Handle tests list: `Add test` button appends `{id:"", input:"", expected_output:""}`, each row has delete. Show `Test N` header.
5. Add import from file: `<input type=file>` that reads JSON.

**Testing**

* Validate with the two sample JSON files. Pasting them should succeed and show in Practice list after reload.
* Invalid JSON or missing title should show inline error without invoking Tauri.
* Add a frontend unit for the validation function.

## Item 3 — Submission history and stats dashboard

### Current gap

Every `submit_solution` inserts a `Submission` `src-tauri/src/db.rs:116`, but there is no read path. `Contest.tsx:61` and `Practice.tsx:25` discard history after rendering. No way to see accuracy per tag, solve streak, or recent failures.

### Design

**New backend** Two read commands. Keep it small.

```rust
#[tauri::command]
pub fn list_submissions(state: State<AppState>) -> Result<Vec<Submission>, String>

#[tauri::command]
pub fn list_submissions_by_problem(state: State<AppState>, problem_id: String) -> Result<Vec<Submission>, String>
```

They select from `submissions` ordered by `submitted_at DESC` and deserialize `context` and `verdict`. Add helper `str_to_verdict` inverse of `verdict_to_str`. Also add `DELETE` helper for clearing history in dev.

Update `src-tauri/src/main.rs:28` `invoke_handler` to include the two new commands.

**Frontend** Route `/history` and `/stats` could be one page with tabs. Keep one page `History.tsx` with two sections: table and charts. Use existing `Card` and `Badge`.

* **Table** All submissions, columns: time, problem title, language, verdict `VerdictBadge`, context `Practice` or `Contest`. Filter by tag, difficulty, verdict, and date. Use `listProblems` to resolve `problem_id` to title.
* **Stats** Compute client side, no SQL aggregation needed for v0.4.0. Per tag accuracy: `accepted / total` where `accepted` counts `Verdict::Accepted`. Solve time trend: average `time_ms`? But `Submission` does not store `time_ms`, only `JudgeReport` does. For now use count per day and accuracy. Add `submitted_at` day bucket. Use a tiny chart lib, either `recharts` already implied or plain `div` bars to avoid new deps. One bar per tag, height `accuracy * 100%`, color `ac` for high, `wa` for low.
* **Drill down** Click a row to expand source code `pre` and `VerdictBadge` with the original `JudgeReport`? The `Submission` stores `source_code` and `verdict` but not the per test details. For v0.4.0 showing verdict and source is enough. For richer detail you could store `JudgeReport` JSON in a new column, but that is an optimization for later.

**File changes**

* `src-tauri/src/db.rs` add `list_submissions`, `list_submissions_by_problem`, helper `str_to_verdict`, optional `delete_submissions`.
* `src-tauri/src/commands.rs` add two commands, update `main.rs` invoke list.
* `src-tauri/src/models.rs` no change.
* `src/lib/api.ts` add `listSubmissions` and `listSubmissionsByProblem`.
* `src/lib/types.ts` ensure `Submission` already has `verdict`, `submitted_at`, `context`.
* `src/pages/History.tsx` new file, about 250 lines. Fetch problems and submissions, compute stats, render table and bar chart.
* `src/App.tsx` add route and nav.

**Step by step**

1. Add Rust read commands. Test with `cargo test` that inserting two submissions then listing returns them ordered. Verify `verdict_to_str` and `str_to_verdict` round trip for all five variants.
2. Expose via `api.ts`. Check `tauri dev` invoke works from console.
3. Build `History.tsx` table first, no chart. Fetch both lists, join `problem_id` to title, render `VerdictBadge` with `showLong`. Add filter dropdown for tag, using `allTags` from `listProblems`.
4. Add stats: compute `perTag` map, render a simple bar using `div` with `h-2 bg-ac` width `accuracy%` inside a `Card`. No external chart lib yet to keep bundle small.
5. Add empty state: when no submissions, show a `Card` with `No submissions yet. Submit a solution in Practice.` and link to `/`.
6. Add delete all for dev, guarded with confirm.

**Testing**

* Rust: after `insert_submission` with each verdict, `list_submissions` returns correct `verdict` string mapping.
* Frontend: with seeded DB and two manual submissions, table shows 2 rows, filter by `implementation` shows 1.
* Performance: submissions table will grow, but ordering by `submitted_at DESC` and client side filtering is fine for hundreds of rows. For thousands, add pagination in v0.4.1.

## Cross-cutting principles

* **Vertical slices** Finish stress UI fully before starting import. Each slice ends with a working route you can click, not a half done shared abstraction.
* **One interface per slice** Stress has `runStressTest`, import has `saveProblem`, history has `listSubmissions`. Do not add a new generic store early.
* **Reuse primitives** All three pages must use `Button`, `Card`, `Badge`, `SplitView`, `CodeEditor`, `VerdictBadge` from `src/components/ui`. No new colors, no new radius, only `border-border` and `bg-card`.
* **Hide information** The judge details stay in `judge.rs`. The UI only sees `JudgeReport` and `Option<[String;3]>`. Do not let the UI touch `TempDir` or `g++` args.
* **No gold-plating** For history, a div bar chart is enough for v0.4.0. For import, comma separated tags are enough before a fancy tag selector. For stress, a language toggle `cpp | java` shared across editors is enough.
* **Error first** Every Tauri invoke can fail. Show the `String` error in a `pre` with `text-wa` and a hint, never swallow it in `console.error` only. The previous CE fix in `Practice.tsx:136` is the pattern to copy.
* **Persist wisely** Use `localStorage` only for `SplitView` ratios and import draft JSON. Do not persist code editors automatically yet; it can clash with problem switching.

## Delivery order and timeline

Given Oct 15 is the stated deadline in `README.md:86` and today is Sep 16, this fits three weeks:

* Week 1 (Sep 16 to Sep 23) Item 1 stress UI. Backend is done, so this is pure frontend. One page, one route, one invoke. Ship as `v0.2.0` milestone 1.
* Week 2 (Sep 24 to Sep 30) Item 2 import. One page, validation, `saveProblem`. Ship as `v0.3.0` milestone 2.
* Week 3 (Oct 1 to Oct 5) Item 3 history. Add two Rust reads, one page with table and simple stats. Ship as `v0.4.0` milestone 3.

Items 4 diff viewer and 5 contest history are already specced as `v0.5.0` and `v0.6.0` and can be done in the remaining ten days before `v1.0.0`.

## Concrete checklist

* [ ] Stress: create `src/pages/Stress.tsx`, add route `/stress` in `src/App.tsx:30`, test `api.runStressTest` with max subarray brute force vs fast, show failing case.
* [ ] Import: create `src/pages/Import.tsx` with Form and JSON tabs, validate, call `api.saveProblem`, add route `/import`.
* [ ] History: add `list_submissions` and `list_submissions_by_problem` in `src-tauri/src/db.rs:116` and `commands.rs:98`, expose in `src/lib/api.ts:4`, create `src/pages/History.tsx`, add route `/history`.
* [ ] For each, run `npm run build` and `cargo check`, then `npm run tauri dev` and manually submit once per verdict to see the human readable messages.
* [ ] Push each slice as a separate commit on `main`, tag `v0.2.0`, `v0.3.0`, `v0.4.0`, and close the matching milestone issue.

This plan keeps the next three increments small, concrete, and directly tied to the files you already have.

