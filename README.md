# Airlock

<p align="center">
  <img src="assets/airlock-logo-wordmark.svg" alt="Airlock — offline-first cp trainer" width="560" />
</p>

An offline-first competitive programming trainer: local problem vault, local judge
(C++ and Java), practice mode, and ICPC-style timed contest mode with penalty
scoring. Built with Tauri (Rust) + React so the judge runs natively against
your own `g++`/`javac`, with zero network dependency at practice time.

> **Rebrand:** This was `CP Trainer` (`cp-trainer`, `com.silvestre.cptrainer`). The app is now **Airlock** (`airlock`, `com.silvestre.airlock`). The product name, window title, and icons now show Airlock. Old data at `~/.local/share/com.silvestre.cptrainer/` is auto-migrated on first run.

## Why this exists

Official Codeforces test data isn't available offline via any public API —
only problem statements and *sample* I/O are. So this tool treats the problem
vault as **yours to curate**:

- Paste in problems (statement + sample tests) while you have internet.
- For anything you want fully judged (not just sample-tested), add your own
  stress tests, or better: write a brute-force reference solution for the
  problem and use **stress test mode** (already wired into the Rust backend
  in `judge.rs::run_stress_test`) to fuzz your solution against it. This is
  a real ICPC skill anyway — building it in is a feature, not a workaround.
- Good non-CF sources that *do* ship downloadable test data: old ICPC
  regional/national archives, Kattis problem packages, UVA.

## Setup (Arch Linux)

```bash
# Rust + system deps Tauri needs on Linux
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
    gtk3 libayatana-appindicator librsvg
rustup default stable   # if you don't already have rustup

# Node deps
npm install

# Run in dev mode (hot reload, opens a native window)
npm run tauri dev
```

First run creates the SQLite DB at
`~/.local/share/com.silvestre.airlock/airlock.sqlite` and the schema is
created automatically (see `src-tauri/src/db.rs`). If you have old data at
`~/.local/share/com.silvestre.cptrainer/cp-trainer.sqlite` it is copied automatically.

### Seed the two sample problems

```bash
python3 scripts/seed_problems.py ~/.local/share/com.silvestre.airlock/airlock.sqlite
# legacy path still works if you have not migrated yet:
# python3 scripts/seed_problems.py ~/.local/share/com.silvestre.cptrainer/cp-trainer.sqlite
```

Restart the app (or reload) and they'll show up in Practice mode. Use these
JSON files as the template for pasting in more problems — same shape as the
`Problem` struct in `src-tauri/src/models.rs`.

### Before your first `tauri build` (not needed for `tauri dev`)

Icons in `src-tauri/icons/` are generated from `assets/airlock-logo-icon.svg`:

```bash
magick -background none assets/airlock-logo-icon.svg -resize 512x512 /tmp/airlock-512.png
npm run tauri icon /tmp/airlock-512.png
```

### Build a real installable binary

```bash
npm run tauri build
```

Output lands in `src-tauri/target/release/bundle/`.

## What's already wired up

- **Local judge** (`src-tauri/src/judge.rs`): compiles C++ (`g++ -O2 -std=c++17`)
  or Java (`javac` + `java -cp`), runs each test with a wall-clock timeout via
  `wait-timeout`, diffs output with whitespace-tolerant normalization, returns
  AC / WA / TLE / RE / CE per test. Stops at the first failing test (matches
  how most judges give you feedback).
- **Stress test lab** (`src/pages/Stress.tsx`): three editors for candidate, brute force and generator, runs `run_stress_test` and shows first mismatch.
- **Practice mode** (`src/pages/Practice.tsx`): browse/filter by tag, untimed,
  Monaco editor, per-test verdict breakdown with diff viewer on WA.
- **Contest mode** (`src/pages/Contest.tsx`): pick a problem set + duration,
  countdown timer, ICPC-style penalty tracking (20 min per wrong submission
  before AC, time-of-solve in minutes), live scoreboard sidebar and past contests history.
- **Import** (`src/pages/Import.tsx`): form and JSON paste for `Problem`, wired to `api.saveProblem`.
- **History** (`src/pages/History.tsx`): submissions table and per-tag accuracy from `submissions`.
- **SQLite persistence** for problems, test cases, submissions, and contests.

## Roadmap — original scaffold (now shipped)

All five items below are done and released. They were the priority for the initial scaffold.

1. **Stress-test UI page** — done in `v0.4.0` `src/pages/Stress.tsx` (`run_stress_test` wired).
2. **Problem import screen** — done in `v0.4.0` `src/pages/Import.tsx` (`api.saveProblem`).
3. **Submission history & stats dashboard** — done in `v0.4.0` `src/pages/History.tsx` (`list_submissions`).
4. **Diff viewer on WA** — done in `v0.6.0` `src/components/DiffViewer.tsx` side-by-side with highlight.
5. **Multi-contest scoreboard history** — done in `v0.6.0` `src/pages/Contest.tsx` past contests via `list_contests`.

Next is the Airlock feature roadmap for Oct 15 in Luanda, tracked in `PLAN_AIRLOCK_1-3.md` and GitHub milestones.

## Airlock roadmap — next batch (Oct 15)

1. Problem notes (your own editorials)
2. Partial scoring
3. Upsolving
4. Team mode
5. Portuguese localization
6. Post-contest polish

## Versions

Track progress on GitHub: [Releases](https://github.com/SilesterGold9/airlock/releases) and [Milestones](https://github.com/SilesterGold9/airlock/milestones).

| Version | Focus | Status | Milestone |
|---------|-------|--------|-----------|
| `v0.1.0` | Foundation — local judge, practice/contest, design system, 2 samples | Released [v0.1.0](https://github.com/SilesterGold9/airlock/releases/tag/v0.1.0) `3654803` | — |
| `v0.2.0` — `v0.4.0` | Stress lab, import, history | Released [v0.4.0](https://github.com/SilesterGold9/airlock/releases/tag/v0.4.0) `171501b` | Milestones 1 to 3 closed |
| `v0.6.0` | Diff viewer and contest history | Released [v0.6.0](https://github.com/SilesterGold9/airlock/releases/tag/v0.6.0) `2e620ae` | Milestones 4 and 5 closed |
| `v0.5.0` | — | Merged into `v0.6.0` | — |
| `v1.0.0` | Polish for Oct 15 — real `contest_id`, limits, tag standard, bundle QA | Planned, due 2026-10-15 | [#6](https://github.com/SilesterGold9/airlock/milestone/6) / [Issue #6](https://github.com/SilesterGold9/airlock/issues/6) |
| Next | Airlock roadmap 1 to 3 — notes, partial scoring, upsolving | Planned, see `PLAN_AIRLOCK_1-3.md` | — |

Versioning is SemVer. Tags are `vMAJOR.MINOR.PATCH` and each Milestone groups the Issues for that version.

## Known rough edges (scaffold, not finished product)

- `submit_solution`'s `context` param for contest submissions currently uses
  a placeholder `contest_id: "current"` — wire the real ID returned by
  `create_contest` through if you want accurate per-contest submission logs.
- No memory/CPU limit enforcement beyond the wall-clock timeout — fine for
  personal practice, not fine if you ever let anyone else's code run here.
- Tags and difficulty are free-form; consider standardizing early (e.g. CF's
  800–3500 rating scale) so future stats/filtering stay meaningful.
