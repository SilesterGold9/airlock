# CP Trainer

An offline-first competitive programming trainer: local problem vault, local judge
(C++ and Java), practice mode, and ICPC-style timed contest mode with penalty
scoring. Built with Tauri (Rust) + React so the judge runs natively against
your own `g++`/`javac`, with zero network dependency at practice time.

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
`~/.local/share/com.silvestre.cptrainer/cp-trainer.sqlite` and the schema is
created automatically (see `src-tauri/src/db.rs`).

### Seed the two sample problems

```bash
python3 scripts/seed_problems.py ~/.local/share/com.silvestre.cptrainer/cp-trainer.sqlite
```

Restart the app (or reload) and they'll show up in Practice mode. Use these
JSON files as the template for pasting in more problems — same shape as the
`Problem` struct in `src-tauri/src/models.rs`.

### Before your first `tauri build` (not needed for `tauri dev`)

`tauri.conf.json` references icon files under `src-tauri/icons/` that don't
exist in this scaffold. Generate them from any square PNG:

```bash
npm run tauri icon path/to/any-square-logo.png
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
- **Stress test engine**: same file, `run_stress_test` — feed it a generator,
  your candidate, and a brute force; it runs random cases until they disagree.
  Not yet wired to a UI page — that's the top item on the roadmap below.
- **Practice mode** (`src/pages/Practice.tsx`): browse/filter by tag, untimed,
  Monaco editor, per-test verdict breakdown.
- **Contest mode** (`src/pages/Contest.tsx`): pick a problem set + duration,
  countdown timer, ICPC-style penalty tracking (20 min per wrong submission
  before AC, time-of-solve in minutes), live scoreboard sidebar.
- **SQLite persistence** for problems, test cases, submissions, and contests.

## Roadmap (in priority order for your Oct 15 deadline)

1. **Stress-test UI page** — the backend command (`run_stress_test`) exists;
   it just needs a page with three code boxes (candidate / brute force /
   generator) and a "run" button showing the first failing case.
2. **Problem import screen** — a form or JSON paste box wired to
   `api.saveProblem`, so you're not editing SQLite by hand for new problems.
3. **Submission history & stats dashboard** — you're already recording every
   submission in the `submissions` table; a page that reads it back into a
   per-tag accuracy chart and a solve-time trend is pure frontend work at
   that point.
4. **Diff viewer on WA** — show expected vs. actual output side by side
   instead of just the raw text blob (the data's already in `TestResult`).
5. **Multi-contest scoreboard history** — right now `create_contest` fires
   and forgets past contests; worth listing past contests and letting you
   review old ones.

## Known rough edges (scaffold, not finished product)

- `submit_solution`'s `context` param for contest submissions currently uses
  a placeholder `contest_id: "current"` — wire the real ID returned by
  `create_contest` through if you want accurate per-contest submission logs.
- No memory/CPU limit enforcement beyond the wall-clock timeout — fine for
  personal practice, not fine if you ever let anyone else's code run here.
- Tags and difficulty are free-form; consider standardizing early (e.g. CF's
  800–3500 rating scale) so future stats/filtering stay meaningful.
