# Airlock — feature roadmap

Companion to the initial scaffold's README. This tracks everything discussed
beyond the MVP (practice mode, contest mode, local judge, stress test engine),
prioritized against the Oct 15 ICPC national deadline in Luanda.

## Priority order

Build top to bottom. Everything below "Post-contest polish" can wait until
after Oct 15 without hurting your training.

1. Problem notes (your own editorials)
2. Partial scoring
3. Upsolving
4. Team mode
5. Portuguese localization (can slot in anywhere — see its own section, it's
   additive and doesn't block the others)
6. Post-contest polish: rating, similar problems, attempt history, skill
   tracks, balloons

---

## 1. Problem notes (from LeetCode)

**What**: a free-text box attached to each problem. After solving (or giving
up), write your own approach/editorial. Shown next to the statement every
time you reopen the problem.

**Why first**: highest value-to-effort ratio, and directly matches how you
already teach — writing the explanation is how it sticks for your juniors,
same applies to you.

**Changes needed**:
- `Problem` struct (`models.rs`): add `notes_md: Option<String>`.
- `db.rs`: add `notes_md` column to `problems` table, include in
  `insert_problem`/`list_problems`.
- New Tauri command `update_problem_notes(problem_id, notes_md)` — cheaper
  than round-tripping the whole `Problem` object on every keystroke; debounce
  the save in the frontend (~1s after typing stops).
- `Practice.tsx`: a collapsible "My notes" panel under the statement, textarea
  + autosave indicator.

---

## 2. Partial scoring (from HackerRank)

**What**: instead of stopping at the first failing test, run all tests and
report `tests_passed / total`. Useful for optimization problems where "how
close" matters more than pass/fail.

**Changes needed**:
- `judge.rs::run_judge`: remove the early-exit `break` on first failure; keep
  running all tests, accumulate results.
- `JudgeReport`: add `tests_passed: u32` and `tests_total: u32` fields.
- `VerdictBadge`/`Practice.tsx`/`Contest.tsx`: show "7/10 tests passed" next
  to the overall verdict badge.
- Contest mode scoring logic stays AC/not-AC for ICPC-style penalty rules —
  partial scoring is a practice-mode-only display, not a scoring change for
  contests (ICPC doesn't do partial credit; don't blur that distinction while
  training for it).

---

## 3. Upsolving (from Codeforces)

**What**: after a virtual contest's timer expires, let submissions against
those problems keep working, but tag them separately so they don't inflate
your timed-contest history.

**Changes needed**:
- `SubmissionContext::Contest`: add `upsolve: bool` field.
- `Contest.tsx`: when `ended` is true, submit button stays enabled but passes
  `upsolve: true`; UI shows an "upsolving" label instead of the live
  scoreboard once the timer's out.
- Stats/history views (once built) filter upsolved submissions out of
  contest-performance charts by default, with a toggle to include them.

---

## 4. Team mode (the one that matters most for Oct 15)

**What**: ICPC is 3 people, 1 computer — Codeforces/LeetCode/HackerRank are
all solo-by-design, so this isn't "stolen" from them, it's the actual gap.
Shared timer, one "driver" seat that rotates, shared problem queue, a note
field per problem for "who's attempting what."

**Changes needed** (heavier than the others — scope for after items 1–3 are
solid):
- `Contest` model: add `team_members: Vec<String>` and `driver: Option<String>`.
- New `problem_claims` table: `problem_id`, `claimed_by`, `status` (thinking /
  coding / stuck / done) — lets teammates see at a glance who's on what
  without talking over each other, same as a real ICPC team would use a
  scratch whiteboard.
- UI: a compact status row above the problem list in `Contest.tsx` — avatar
  initials + status per problem.
- This is the one feature worth testing with your actual teammates before the
  15th, not just solo — the point is rehearsing coordination, not just
  problem-solving speed.

---

## 5. Portuguese localization

**Goal**: add PT support without polluting the codebase — no `if (lang ===
"pt")` scattered through components, no duplicated JSX per language.

**Approach**: a tiny custom i18n layer (skip `react-i18next` — it's overkill
for a one-person app with a few dozen strings, and it's one more dependency
to fight with mid-crunch).

**Structure**:
```
src/lib/i18n/
  en.json        # { "practice.submit": "Submit", "practice.judging": "Judging...", ... }
  pt.json        # { "practice.submit": "Submeter", "practice.judging": "A avaliar...", ... }
  index.tsx      # LocaleProvider + useT() hook
```

**How components use it** — one hook, no branching in component logic:
```tsx
const t = useT();
<button>{t("practice.submit")}</button>
```

**Why this stays non-polluting**:
- Components never check the current language directly — they just call
  `t(key)`. Swapping locale is a provider-level change, not a per-component
  one.
- JSON files are flat key → string maps, so a missing PT key falls back to
  English automatically (log a console warning in dev, don't crash).
- Problem statements themselves are user data (whatever you paste into the
  vault), not app UI strings — they're not part of this i18n layer at all.
  If you want a problem available in both languages, that's a `statement_md`
  vs `statement_md_pt` field on `Problem`, entirely separate concern from UI
  translation.
- Persist the choice in `localStorage` (via a tiny wrapper, not scattered
  `localStorage.getItem` calls) — one line in `LocaleProvider`, not a Tauri
  command, since it's a pure UI preference with no need to live in SQLite.

**Scope for v1**: nav labels, button text, verdict badges' tooltips, contest
setup form labels. Skip translating problem statements/notes — that's your
content, written in whichever language you wrote it in.

**Effort**: genuinely small — a `LocaleProvider`, a `useT` hook, two JSON
files, and a language toggle in the nav bar. Can be done in an afternoon
whenever it's convenient; it doesn't block or get blocked by any feature
above.

---

## 6. Post-contest polish (after Oct 15)

- **Personal rating**: Elo-like number that moves based on problems solved
  relative to difficulty and time remaining, computed from virtual contest
  history. Gives you a trend line instead of disconnected scores.
- **Similar problems**: same tags + adjacent difficulty, surfaced after
  solving or failing a problem. Pure query against existing tag data.
- **Attempt history per problem**: last 3 attempts' verdicts/times shown when
  reopening a problem. Data already exists in `submissions`.
- **Skill tracks**: curated ordered sequences (e.g. "Graphs week 1: BFS →
  shortest path → bipartite check") instead of flat tag filtering — you could
  reuse your own DSA tutoring sequence as the first track.
- **Balloons**: cosmetic per-AC animation in contest mode, matching real ICPC
  balloon colors. Nice-to-have, zero functional value.
