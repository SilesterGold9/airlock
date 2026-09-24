# CP Trainer Design System Plan — LeetCode DNA

CP Trainer is now at https://github.com/SilesterGold9/airlock. This plan harvests LeetCode's brand DNA and turns it into a concrete token and component system you can build on top of the current Tauri + React + Tailwind stack.

## Why this plan exists

You said LeetCode feels smooth, premium, sharp, with top notch animations. The current CP Trainer uses `bg-slate-800`, `JetBrains Mono` on the whole body (`src/index.css:5`), and a flat emerald button. It works, but it feels rough. LeetCode's premium feel comes from restraint, not orange.

## Research notes

Live fetch of `leetcode.com`, `leetcode.com/problemset`, `leetcode.com/problems/two-sum`, `leetcode.com/contest` is blocked by Cloudflare. The shell still confirmed the split pane and contest hero. Best tokens came from:

* Dumped production `:root` gist with `--brand-orange: #ffa116`, `--gray-*`, `--green-60`, `--red-60`, `--teal-60`, `--yellow-60` and semantic `--sd-*` variables — closest to LeetCode's real system.
* CheetCode and FireCode clones — production shadcn wiring with `darkMode: class`, `--radius: 0.5rem`, HSL semantic tokens, `Inter` for UI and `Monospace` for code.

## What makes LeetCode feel premium

1. Almost black base `#0f0f0f`, panels `#1a1a1a`, cards `#262626` to `#282828`. Not cool slate. Warm black lets orange pop without shouting.
2. Borders, not shadows. Dark elevation is a 1px `rgba(255,255,255,0.10)` border and a one step lighter surface. Light uses `0 1px 2px rgba(0,0,0,0.05)`. Sharp, no fuzz.
3. Radius is consistent. `4px` inline code and tag, `6px` input, `8px` button and card, `12px` hero. Nothing random.
4. Typography is tight. UI is `Inter` at `13-14px`, weight `400/500/600` only where needed. Code is `JetBrains Mono` 14px/20px, `tabSize 4`, ligatures in editor only.
5. Density with air. Problem rows `44-48px` tall, `12px` padding, then generous section gaps. Code page is two equal panes with a `1px` draggable gutter `#333` that turns `#ffa116` on hover.
6. Color with intent. Brand orange `#ffa116` only for CTA and active ring. Difficulty and verdict have their own scales and never compete. Easy `#00af9b` / `#46c6c2`, Medium `#ffc01e` / `#fac31d`, Hard `#ff375f` / `#f8615c`.
7. Motion is fast and soft. Hover `150ms ease`, panel `200ms cubic-bezier(0.2,0,0,1)`, accordion `200ms ease-out`, no bounce, no layout jank. Opacity first, transform second.

## Harvested tokens

### Color primitives (verbatim from production dump)

```
--brand-orange: #ffa116
--brand-white: #fff
--brand-black: #000
--gray-10: #1a1a1a
--gray-20: #262626
--gray-30: #323232
--gray-40: #3a3a3a
--gray-50: #777777
--gray-60: #949494
--gray-70: #b7b7b7
--gray-90: #e8e8e8
--gray-100: #f5f5f5
--gray-black: #0f0f0f
--green-60: #28c244
--yellow-60: #fac31d
--red-60: #f8615c
--teal-60: #46c6c2
--blue-60: #1a90ff
--purple-60: #c477e5
```

Semantic:

```
--sd-background: 0 0% 6%        // #0f0f0f page
--sd-card: 0 0% 15%             // #262626 card
--sd-popover: 0 0% 20%          // #333333 menu
--sd-secondary: 0 0% 22%        // #383838 secondary
--sd-muted-foreground: 0 0% 66% // #a8a8a8 secondary text
--sd-border: 0 0% 100% / 0.10   // rgba(255,255,255,0.10)
--sd-input: 0 0% 100% / 0.14
--sd-ring: 240 4.9% 83.9%
--difficulty-easy: var(--teal-60)
--difficulty-medium: var(--yellow-60)
--difficulty-hard: var(--red-60)
```

Mapping for current `ac/wa/tle/re/ce`:

* `ac` -> `#28c244` dark, `#16a34a` light, soft `hsl(var(--success)/0.15)`
* `wa` / hard -> `#ff375f` or `#ef4444`
* `tle` -> `#fac31d` (brighter than current `#f59e0b`)
* `re` -> `#f8615c` or distinct `#c477e5`
* `ce` -> `#64748b` muted to `#a1a1aa` on dark

### Typography

```
--font-sans: "Inter", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial
--font-mono: "JetBrains Mono", SF Mono, Monaco, Menlo, Consolas, monospace
text-xs 12px/16px 400 meta and timestamps
text-sm 13px/18px 400/500 list rows, tags
text-base 14px/22px 400 body (real LeetCode body, not 16px)
text-[15px]/22px problem title
text-lg 16px/24px section headings
text-xl 20px/28px page titles 600
text-2xl 24px/32px contest hero
code 14px/20px tabSize 4
```

### Spacing, radius, borders, shadows, motion

```
space: 4, 8, 12, 16, 20, 24, 32, 40, 48
radius: sm 4px inline code/tag, md 6px input, lg 8px button/card/editor, xl 12px hero, full 9999px
border dark: 1px solid rgba(255,255,255,0.10), light: 1px solid rgba(0,0,0,0.08), divider: #333333
shadow dark: none, light sm 0 1px 2px rgba(0,0,0,0.05), md 0 4px 12px rgba(0,0,0,0.08), ring 0 0 0 2px rgba(255,161,22,0.35)
duration fast 150ms, base 200ms, slow 300ms
ease default cubic-bezier(0.2,0,0,1), out cubic-bezier(0.16,1,0.3,1), in-out cubic-bezier(0.65,0,0.35,1)
z nav 50, sticky 40, dropdown 100, overlay 200, toast 300
bp sm 640, md 768 sidebar collapses, lg 1024 50/50 split, xl 1280 max +24 gutters
```

## Proposed Tailwind and CSS

### tailwind.config.js (replace current)

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        brand: { DEFAULT: "#ffa116", foreground: "#000000" },
        ac: { DEFAULT: "hsl(var(--success))", soft: "hsl(var(--success) / 0.15)" },
        wa: { DEFAULT: "hsl(var(--destructive))", soft: "hsl(var(--destructive) / 0.15)" },
        tle: { DEFAULT: "#fac31d", soft: "#fac31d26" },
        re: { DEFAULT: "#c477e5", soft: "#c477e526" },
        ce: { DEFAULT: "#64748b", soft: "#64748b26" },
        difficulty: { easy: "#00af9b", medium: "#ffc01e", hard: "#ff375f" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial"],
        mono: ["JetBrains Mono", "SF Mono", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: { sm: "4px", md: "6px", lg: "8px", xl: "12px" },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { transform: "translateY(4px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "fade-in": "fade-in 200ms cubic-bezier(0.2,0,0,1)",
        "slide-up": "slide-up 200ms cubic-bezier(0.2,0,0,1)",
        "accordion-down": "accordion-down 200ms ease-out",
        "accordion-up": "accordion-up 200ms ease-out",
      },
    },
  },
  plugins: [],
};
```

### src/index.css (replace current)

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");
@tailwind base;
@tailwind components;
@tailwind utilities;
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 24 100% 54%;
    --success: 142 72% 38%;
    --destructive: 0 84% 60%;
    --radius: 8px;
  }
  .dark {
    --background: 0 0% 6%;
    --foreground: 0 0% 96%;
    --card: 0 0% 15%;
    --card-foreground: 0 0% 96%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 24 100% 54%;
    --success: 140 60% 40%;
    --destructive: 355 95% 68%;
  }
  * { @apply border-border; }
  body { @apply bg-background text-foreground font-sans antialiased; font-size: 14px; line-height: 1.5; }
  code, pre, .font-mono { font-family: var(--font-mono); }
}
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: #444; }
```

Set `class="dark"` on `html` in `index.html`.

## Component primitives to build

**Button** `h-8` default, `h-7` small, `px-3`, `rounded-lg`, `text-sm font-medium`, `transition-colors duration-150`. Primary `bg-[#ffa116] text-black hover:bg-[#ffb23f]`, secondary `bg-white/[0.08] hover:bg-white/[0.12]`, ghost `hover:bg-white/[0.06]`, focus `ring-2 ring-brand/30 ring-offset-1`.

**Card** `bg-card border border-border rounded-lg p-4`. Use for problem description, console, contest setup. In dark it is `#262626` with `14.9%` border.

**Badge / Difficulty / Verdict** `inline-flex rounded-full px-2 py-0.5 text-xs font-medium border`. Easy `text-[#00af9b] bg-[#00af9b]/12`, medium `text-[#ffc01e] bg-[#ffc01e]/14`, hard `text-[#ff375f] bg-[#ff375f]/12`. Update `src/components/VerdictBadge.tsx` to this pill style, keep `long` for tooltip.

**SplitView** Replace static `w-1/2` in `Practice.tsx` and `Contest.tsx`. Gutter `w-1 hover:w-1.5 bg-border hover:bg-brand cursor-col-resize`, min left `320px` right `420px`, snap `200ms cubic-bezier(0.2,0,0,1)`, persist ratio in `localStorage`.

**Editor wrapper** `rounded-lg overflow-hidden border border-border` with header `h-10 flex items-center justify-between bg-card px-3 border-b`. Select `bg-white/[0.08] rounded-md h-7 px-2 text-sm`. Monaco `fontSize 14 lineHeight 20 minimap false tabSize 4`.

**Navigation** `src/App.tsx` sticky `top-0 z-50 h-12 bg-background/80 backdrop-blur-md border-b border-border px-4`. Active `bg-white/[0.08]`, inactive `text-muted-foreground hover:text-foreground hover:bg-white/[0.04]` with `150ms`.

**Table rows** Problem list `h-11 px-3 flex items-center hover:bg-white/[0.04] border-b border-white/[0.06] transition-colors duration-150`.

**Test details** Keep `details` but style `open:bg-card rounded-lg border border-border`, `summary list-none flex justify-between px-3 py-2 cursor-pointer`, content `animate-accordion-down`.

## Page patterns to replicate

* Problem list `/problemset`: muted header `text-sm`, rows `44px` hover `white/[0.04]`, difficulty pill `12px` uppercase with color only on text.
* Problem detail `/problems/two-sum`: equal panes with draggable divider, left tabs `Description | Editorial | Solutions | Submissions` with `2px` `#ffa116` underline, right header `40px` with run buttons `32px`, console collapsed `44px` expand `320px`.
* Contest `/contest`: hero gradient `#0f0f0f` to `#1a1a1a`, CTA `bg-brand-orange text-black rounded-lg`, past contests `bg-[#282828] rounded-[12px] border 14%`.
* Profile: heatmap `4px` squares `rounded-sm` with 5 step greens `#1a1a1a` to `#28c244`, stats `bg-[#282828] rounded-lg p-4`.

## Motion

Use Tailwind utilities: `transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]` for hover, `transition-all duration-200` for panels, `animate-fade-in` on mount. Animate only `transform` and `opacity`, never `width` on text. Keep under `300ms` so it feels snappy.

## What not to copy

* Do not use `#ffa116` as text on white. It fails WCAG AA. Use only as bg with black text or as ring and border.
* Do not use `text-quaternary 60%` for long prose. Use `text-secondary 80%` minimum for statements, check `4.5:1`.
* Do not use `13px` everywhere. Keep `14px` body, `12px` only for tags.
* Do not invent new radius per component. Stick to `4, 6, 8, 12`.
* Branding risk. If it looks too much like LeetCode, users trust it less. Swap accent to `#ff9d00` or use `#ffa116` only for primary CTA and keep your own wordmark.

## Implementation plan — phased

### Phase 0 — Foundation (1 day)

1. Update `tailwind.config.js` and `src/index.css` as above, add `Inter` import, set `dark` class on `html`, test light and dark. Run `npm run build` and `cargo check`.
2. Refactor `src/App.tsx` nav to sticky blurred version.
3. Replace `body` mono with `font-sans`, keep `font-mono` only on `code`, `pre`, editor.
4. Commit as `design: add LeetCode-inspired tokens and dark base`.

### Phase 1 — Primitives (1 to 2 days)

1. Create `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `split-view.tsx` with the specs above.
2. Update `src/components/VerdictBadge.tsx` to pill, update `src/components/CodeEditor.tsx` wrapper to `rounded-lg` with new header.
3. Replace ad hoc `bg-slate-*` in `Practice.tsx` and `Contest.tsx` with `Card` and `Button`. Keep logic, only swap classes.
4. Add `SplitView` with `localStorage` persist and `150ms` hover, verify drag feels instant.

### Phase 2 — Lists and detail polish (1 day)

1. Rework problem list rows to `h-11` hover pattern, add difficulty pills with correct colors.
2. Polish test result `details` with `animate-accordion-down`, add copy button for compiler output.
3. Add navigation active underline `2px` brand for problem tabs if you add tabs.

### Phase 3 — Contest and motion (1 day)

1. Add contest hero gradient and primary CTA, past contests `rounded-[12px]` cards.
2. Wire `transition-colors duration-150` everywhere, add `animate-fade-in` on mount, test that no layout jank occurs.
3. Run `npx tauri dev` and check Tauri window feels native, no blur lag on Hyprland.

### Phase 4 — QA and docs (half day)

1. Contrast check with axe, ensure `text-secondary` passes `4.5:1`.
2. Screenshot dark and light, add to `DESIGN_SYSTEM.md`.
3. Tag release and push.

## Checklist for next session

* [ ] Apply `tailwind.config.js` and `src/index.css` tokens
* [ ] Build `ui/button`, `ui/card`, `ui/badge`, `ui/split-view`
* [ ] Migrate `Practice.tsx` and `Contest.tsx` to `SplitView` and new badges
* [ ] Verify `npm run tauri dev` still `1.4s` build and `vite 210ms`
* [ ] Push to `SilesterGold9/airlock` main

## Sources

* Production `:root` dump gist
* CheetCode and FireCode clones
* LeetCode problem, problemset, contest pages (Cloudflare limited, used clones for pixel values)
* Current CP Trainer `tailwind.config.js:1`, `src/index.css:5`, `src/App.tsx:8`

## As-built (v2.0 workspace revamp)

What actually shipped, where it differs from the proposal above:

* Dark theme went neutral warm-black (`--background 0 0% 10%`, `--card 0 0%
  15%`, white/10 borders) instead of slate. Accent is green (`--success
  134 61% 46%`); orange survives only in the wordmark/logo and prose links.
  `Button primary` is a green-ghost CTA, `success` is solid green.
* App shell is a slim `h-11` nav (compact tabs + avatar chip), not the
  `h-12` blurred bar. Titlebar unchanged.
* Practice is a true workspace: toolbar (list drawer, prev/next/shuffle,
  centered Submit, console toggle), `PanelTabs` (Description/Notes/Similar/
  Submissions), drawer-held problem list (filter + training set + due),
  editor card with `airlock-dark` Monaco theme + Ln/Col footer, collapsible
  Testcase/Test Result console.
* Contest mirrors the workspace (letter pills, compact timer, team chip,
  Description/Team/Standings tabs, same console).
* Motion: `panel-in`, `pop`, `drawer-in` keyframes added; global
  `button:focus-visible` ring in `index.css`; `prefers-reduced-motion`
  disables non-essential animation.
* Deliberately NOT built: theme-creation UI for rank themes, in-app pack
  import button (CLI scripts only), skeleton loaders (local SQLite is
  near-instant), axe contrast audit (manual QA).


## As built (deviations from the proposal above)

The proposal harvests LeetCode's orange system. What shipped differs in
three places, deliberately:

* Accent is green `#22c55e` (`brand` and `ac` in `tailwind.config.js`),
  not orange `#ffa116`. Orange survives only in the wordmark and prose
  links. Difficulty and verdict scales are unchanged.
* Radius ladder collapsed one rung: inputs, buttons, cards, and the editor
  all use `rounded-lg` (8px). Chips and code stay 4px, heroes 12px.
* App shell is an `h-8` custom `Titlebar.tsx` plus a `w-52` `Sidebar.tsx`
  with grouped sections, not the proposed `h-12` blurred top bar.
