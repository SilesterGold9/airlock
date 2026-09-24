---
name: frontend-conventions
description: Covers React, Tailwind, Monaco, i18n, components, pages, App.tsx, api.ts, CodeEditor, and SplitView conventions for writing frontend code in this repo.
---

# Frontend conventions

Scope is frontend only: `src/`, `index.html`, `tailwind.config.js`, `vite.config.ts`, `package.json`. Do not touch `src-tauri/`.

## Where things live

* Entry is `src/main.tsx`. It renders `LocaleProvider` wrapping `HashRouter` wrapping `App` under `React.StrictMode`. `HashRouter` lives here, not in `App.tsx`, because Tauri serves from file URLs.
* Routes live in `src/App.tsx`. Routes are `/` (Practice), `/contest`, `/stress`, `/recall`, `/techniques`, `/journey`, `/history`, `/import`, `/guide`, `/welcome`, `/settings`. Shell is `Titlebar` plus `Sidebar` plus `main`, all inside `TourProvider`. `App.tsx` also gates onboarding to `/welcome` when `airlock.onboarded` is not `1` and shows `WhatsNew` after version changes.
* Pages live in `src/pages/`. Each page is a full route. `Practice.tsx` and `Contest.tsx` are workspaces. The rest are centered `max-w-3xl` content pages, except `Stress.tsx` and `Import.tsx` which use their own layouts.
* Shared components live in `src/components/`. Workspace chrome is `PanelTabs.tsx` (`PanelTabs`, `ToolButton`, `Icon`, `WS_ICONS`), `ResultConsole.tsx`, `LazyCodeEditor.tsx`, `CodeEditor.tsx`, `ProblemStatement.tsx`, `VerdictBadge.tsx`, `DiffViewer.tsx`, `TourProvider.tsx`, `Titlebar.tsx`, `Sidebar.tsx`.
* Primitives live in `src/components/ui/`: `button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`, `split-view.tsx`. Use these before building anything inline.
* Frontend logic lives in `src/lib/`: `api.ts`, `types.ts`, `persist.ts`, `drafts.ts`, `templates.ts`, `editorTheme.ts`, `verdict.ts`, `tours.ts`, `tracks.ts`, `rating.ts`, `trainingSet.ts`, `samples.ts`, `guide.ts`, `changelog.ts`, `updater.ts`, `i18n/index.tsx`, `i18n/en.json`, `i18n/pt.json`.
* Static shell is `index.html`: `html` carries `class="dark"`, `body` uses `bg-background text-foreground`, mount point is `#root`, module entry is `/src/main.tsx`.

## Routing and app shell

* Keep `HashRouter` in `src/main.tsx`. Add routes in `src/App.tsx` with `Route` inside `Routes`.
* `Sidebar.tsx` is `w-52`, grouped as train, progress, manage. Nav rows are `h-8 rounded-md text-[13px]`, active is `bg-white/[0.08]`, inactive is `text-muted-foreground` with hover styles. `Alt+1` through `Alt+9` navigate via `FLAT_ORDER`. Locale toggle lives in the sidebar footer.
* `Titlebar.tsx` is `h-8`, renders only in Tauri runtime via `__TAURI__` check, uses `getCurrentWindow()` for minimize, maximize, close. It returns null in browser dev.
* Onboarding uses `localStorage` keys `airlock.onboarded`, `airlock.displayName`, `airlock.defaultLang`. First run seeds samples via `api.seedSampleProblems()` once under `airlock.seededSamples`.

## Styling tokens and primitives

* Colors come from `tailwind.config.js` plus `src/index.css` vars. Use `bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-input`, verdict colors `bg-ac`, `bg-wa`, `bg-tle`, `bg-re`, `bg-ce` and their soft variants, difficulty colors `text-difficulty-easy` and related. Brand green is `#22c55e` in config. Do not add ad hoc `bg-[#...]` or `text-[#...]` classes. The one exception is data driven difficulty color in `src/components/ui/badge.tsx`, which uses inline style hex `#00af9b`, `#ffc01e`, `#ff375f` with translucent backgrounds.
* Dark theme is warm black in `src/index.css`: `--background 0 0% 10%`, `--card 0 0% 15%`, borders `0 0% 100% / 0.1`, accent `--success 134 61% 46%` green. Light theme is white card with slate muted text. Orange survives only in the wordmark and prose links, not as a UI accent.
* Fonts are `Inter` for UI and `JetBrains Mono` for code, loaded in `src/index.css`. Body is 14px with tight tracking. Keep `font-mono` to `code`, `pre`, editor, and numeric badges.
* Radius mapping in config is `sm 4px`, `md 6px`, `lg 8px`, `xl 12px`. In practice code uses `rounded-lg` for buttons, cards, inputs, selects, textareas, editor wrappers, and `rounded-full` for pills and chips. `VerdictBadge` uses `rounded-full` at `sm` and `rounded-lg` at `lg`.
* Primitive API:
  * `Button` in `src/components/ui/button.tsx`: variants `primary` (green ghost), `secondary`, `ghost`, `success` (solid green). Sizes `sm h-7`, `md h-8`, `lg h-9`. Base includes focus ring and `active:scale-[0.97]`.
  * `Card` in `src/components/ui/card.tsx`: `bg-card border border-border rounded-lg`. Use `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` for content pages.
  * `Badge` and `DifficultyBadge` in `src/components/ui/badge.tsx`: pill with border. Difficulty threshold is under 1000 easy, under 1600 medium, else hard.
  * `Input`, `Select`, `Textarea`: `rounded-lg border-input bg-input`, focus ring `ring-ring`. `Select` accepts `size sm` or `md`.
  * `PanelTabs` is `h-11` with animated underline `h-0.5 rounded-full`. `ToolButton` is `w-7 h-7 rounded-md` icon button with `active:scale-95`.
* Motion: hover uses `transition-colors duration-150`. Panels mount with `animate-fade-in` or `animate-panel-in`. Drawers use `animate-drawer-in`. Result updates use `animate-pop`. Keyframes in `tailwind.config.js` are `fade-in`, `panel-in`, `drawer-in`, `pop`, `slide-up`, all 180 to 200ms with `cubic-bezier(0.2,0,0,1)`. Accordion uses 200ms ease out. Animate opacity and transform only. Global `prefers-reduced-motion` handling lives in `src/index.css`. Global `button:focus-visible` ring lives there too.
* Prose: `ProblemStatement.tsx` uses `prose prose-invert` with explicit overrides for paragraphs, headings, code, pre, blockquote, tables, plus custom Input and Output callouts. Markdown pipeline is `react-markdown` with `remark-gfm`, `remark-math`, `rehype-katex`. Preprocess only rewrites bold Input and Output markers and light LaTeX cases.

## I18n rules

* All user strings go through `useT()` or `useLocale()` from `src/lib/i18n/index.tsx`. Never hardcode user facing copy in JSX.
* Catalogs are `src/lib/i18n/en.json` and `src/lib/i18n/pt.json`. Both files hold 479 keys with full parity. Add every new key to both files in the same edit.
* Provider is `LocaleProvider` in `src/main.tsx`. Storage key is `airlock:locale`. Lookup falls back to English with a dev only console warning. `document.documentElement.lang` syncs on change.
* Copy tone is factual. No cheerleading, no streaks, no red failure banners. Error surfaces use muted text with `wa` accents, as in `ResultConsole.tsx`.

## Data flow and state rules

* `src/lib/api.ts` is the only file that calls `invoke` from `@tauri-apps/api/core`. Do not import `invoke` elsewhere. The only other Tauri imports allowed are `getVersion` in `src/lib/updater.ts` and `getCurrentWindow` in `src/components/Titlebar.tsx`.
* Types live in `src/lib/types.ts`: `Problem`, `TestCase`, `TestResult`, `JudgeReport`, `Submission`, `SubmissionContext`, `Contest`, `ProblemClaim`, `Technique`, verdict and failure category unions. `SubmissionContext` is `"Practice"` or `{ Contest: { contest_id, upsolve } }`. Judge calls take `problemId`, `language cpp or java`, `sourceCode`.
* Ephemeral UI state uses `useState`. Workspace chrome that must survive route unmounts uses `usePersistentState` from `src/lib/persist.ts`, which is JSON backed `localStorage` with best effort try and catch.
* Established persistent keys use the `airlock.` prefix: `airlock.practice.lang`, `airlock.practice.panelTab`, `airlock.practice.consoleOpen`, `airlock.practice.consoleTab`, `airlock.practice.selected`, `airlock.contest.selectedIds`, `airlock.contest.duration`, `airlock.contest.name`, `airlock.contest.lang`, `airlock.contest.team`, `airlock.recall.technique`, `airlock.recall.lang`, `airlock.recall.minutes`, `airlock.stress.problem`, `airlock.stress.lang`, `airlock.stress.maxCases`, `airlock.stress.timeLimit`, `airlock.journey.reflection`, `airlock.checklist.dismissed`, `practice-split`, `contest-split`. Settings keys are `airlock.displayName`, `airlock.defaultLang`, `airlock.practiceTemplate`, `airlock.reviewDays`. New keys must keep the same prefix and be JSON serializable.
* Code drafts live in `src/lib/drafts.ts` as `airlock.draft.{problemId}.{language}`. Practice saves on problem switch and on every editor change. Stress buffers use `airlock.stress.candidate`, `airlock.stress.brute`, `airlock.stress.generator` with per language suffixes. Quota failures are swallowed.
* Notes autosave with debounce, currently 900ms in `Practice.tsx`. Submissions refresh `historySubs` on `submitSeq` change.

## Editor rules

* Always render `LazyCodeEditor`, never `CodeEditor` directly. `LazyCodeEditor.tsx` uses `React.lazy` so Monaco stays out of the initial bundle.
* `CodeEditor.tsx` calls `loader.config({ monaco })` for local bundling. Offline workers come from the `localMonacoWorkers` Vite plugin in `vite.config.ts`, served at `/monacoeditorwork/editor.worker.bundle.js`. Do not switch Monaco back to CDN.
* Theme is `airlock-dark` from `src/lib/editorTheme.ts`, background `#262626` to sit inside cards. Editor options are fixed: `fontSize 14`, `lineHeight 20`, `tabSize 4`, `minimap false`, `wordWrap on`, ligatures on, bracket colorization on. Keep these values unless typography changes globally.
* The editor is uncontrolled. Parent passes `initialValue` plus `editorKey`. Typing never writes React state. Parent reads code only through `CodeEditorHandle` (`getValue`, `setValue`, `focus`) held in a `useRef`. Pattern in pages:
  * `const editorRef = useRef<CodeEditorHandle>(null)`
  * `<LazyCodeEditor ref={editorRef} language={language} initialValue={editorSeed.value} editorKey={editorSeed.key} ... />`
  * read with `editorRef.current?.getValue() ?? ""` inside run and submit handlers.
* `onContentChange` is for autosave side effects only, such as `saveDraft`. It must not call state setters that rerender the page on every keystroke. The file stores the callback in a ref for this reason.
* Language switching stashes per language buffers in `draftsRef` and restores silently when a draft exists. First switch away from dirty code asks for confirmation via `editor.switchConfirm`. Reset asks via `editor.resetConfirm`.
* Templates come from `src/lib/templates.ts` via `templateFor(lang, set)`. Practice uses `analysis` by default and `standard` as opt in. Contest and Stress use `standard`. `languageTemplates` prop overrides per language scaffolds in Stress. `draftScope` is usually the problem id and clears the stash on change so code never leaks across problems.
* Focus mode is optional via `onToggleFocus` and `focused`. Practice, Contest, and Recall wire it to their `focusedPanel` state.

## Workspace patterns

* `SplitView` in `src/components/ui/split-view.tsx` takes `left`, `right`, `storageKey`, `initialPercent 50`, `minLeft 320`, `minRight 420`. Practice uses `storageKey="practice-split"`, Contest uses `storageKey="contest-split"`. Gutter is `w-1 hover:w-1.5 bg-border hover:bg-brand cursor-col-resize` with keyboard `ArrowLeft` and `ArrowRight` support and persisted percent clamped to 10 to 90. Always pass a storage key for Practice and Contest splits.
* Practice layout in `src/pages/Practice.tsx`: toolbar with drawer button, prev, next, shuffle, centered Run and Submit, console toggle; left panel with `PanelTabs` for `description`, `notes`, `similar`, `attempts`; right column with checklist, `LazyCodeEditor`, `ResultConsole`. Contest in `src/pages/Contest.tsx` mirrors this with letter pills, timer, team chip, and Description, Team, Standings tabs.
* Focus mode uses `focusedPanel: null | left | right | console`. Focused panels render as `fixed inset-2 z-[70]`. `Escape` exits. Editor and console expose expand and restore buttons with `editor.focusPanel` and `editor.unfocusPanel` strings.
* `ResultConsole.tsx` props are `tests`, `timeLimitMs`, `report`, `submitSeq`, `lastWasSubmit`, `tab`, `onTabChange`, `open`, `onToggleOpen`, `expanded`, `onToggleExpand`, `failureSlot`, `busy`, `runError`. Height is draggable from 140 to 720, default 256. Busy shows skeleton rows. Compile errors show compiler output in a `font-mono` pre block. Wrong answers use `DiffViewer`. `FailureChips` renders only after a submit that is not Accepted.
* Drawers are `fixed inset-0 z-[80]` with `bg-black/50 animate-fade-in` backdrop and `w-[380px] max-w-[90vw] animate-drawer-in rounded-r-xl` aside, as in Practice problem list.
* Tour anchors use `data-tour`: `nav` in `Sidebar.tsx`, `open-problems`, `run-submit`, `editor` in `Practice.tsx`, `console` in `ResultConsole.tsx`, `techniques` in `Techniques.tsx`. Tour definitions live in `src/lib/tours.ts` with `first-run` covering five steps. Behavior lives in `TourProvider.tsx`. Completion persists as `airlock.tour.{id}.done`. Keep anchors stable when editing markup.

## Testing and verification

* Unit tests are pure lib only. Covered files are `src/lib/rating.test.ts` and `src/lib/trainingSet.test.ts`, run with Vitest. They import rating, training set, verdict, and types only. No DOM, no Tauri, no Monaco in tests.
* Verification order for frontend changes:
  * `npm run build` which runs `tsc && vite build` and must pass.
  * `npm test` which runs `vitest run`.
* Manual QA that automation does not cover: `npm run tauri dev`, one submit per verdict, keyboard only walk with visible focus rings, PT toggle.
* Node requirement is 24 or later via `.nvmrc` and `package.json` engines. Build target is `esnext` with esbuild minify in `vite.config.ts`.
