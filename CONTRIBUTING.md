# Contributing to Airlock

Small rules that keep this codebase fast to work in. They exist because
violating them caused real rework before.

## UI

- Tokens, not hex. Colors come from `tailwind.config.js` (`bg-card`,
  `border-border`, `text-muted-foreground`, `bg-ac`, `text-wa`, …) and
  `src/index.css` vars. No ad-hoc `bg-[#...]` / `text-[#...]` outside
  `tailwind.config.js` and data-driven styles (difficulty colors).
- Primitives first: `src/components/ui/` (`Button`, `Card`, `Badge`,
  `Input`, `Select`, `Textarea`), `PanelTabs` + `ToolButton` for workspace
  chrome, `CodeEditor` for code. Don't rebuild buttons or tabs inline.
- Radius ladder: `4px` chips/code, `6px` inputs, `8px` buttons/cards,
  `12px` heroes. Nothing else.
- Motion: hover `150ms`, panels `200ms cubic-bezier(0.2,0,0,1)`, keyframes
  `fade-in` / `panel-in` / `pop` / `drawer-in`. Animate opacity and
  transform only. `prefers-reduced-motion` is handled globally.
- Copy: every user-facing string goes through `useT()` + `en.json` /
  `pt.json` (both locales, same keys). Factual tone — no cheerleading,
  no streaks, no red failure banners (see issue #19).

## Backend (Tauri/Rust)

- One command per feature slice, registered in `main.rs invoke_handler`.
- New columns migrate via `ALTER TABLE …` guarded with `let _ =` in
  `db::init` so existing installs never break. New tables use
  `CREATE TABLE IF NOT EXISTS`.
- `Option` reads defensively: `row.get(n).ok().flatten()`.

## Verify loop (two commands, no GUI needed)

```bash
npm run build            # tsc + vite, must pass
# Rust (plain `cargo` shim is broken in some envs — use the toolchain binary):
export RUSTUP_OFFLINE=true
~/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/cargo check --offline  # in src-tauri/
```

Manual QA that automation can't cover: `npm run tauri dev`, one submit
per verdict, keyboard-only walk (focus rings), PT toggle.

## Process

- One commit per issue, message `type: short description (#NN)`.
- No new dependencies without discussion in the issue first.
- Never commit secrets, `__pycache__`, or `dist/`.
