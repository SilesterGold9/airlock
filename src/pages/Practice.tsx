import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { loadDraft, saveDraft } from "../lib/drafts";
import { templateFor } from "../lib/templates";
import { usePersistentState } from "../lib/persist";
import type { JudgeReport, Problem, ReimplementationSchedule, Submission, Technique } from "../lib/types";
import LazyCodeEditor, { type CodeEditorHandle } from "../components/LazyCodeEditor";
import FirstWeekChecklist from "../components/Checklist";
import ResultConsole from "../components/ResultConsole";
import Spinner from "../components/Spinner";
import VerdictBadge from "../components/VerdictBadge";
import { Badge, DifficultyBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { SplitView } from "../components/ui/split-view";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { PanelTabs, ToolButton } from "../components/PanelTabs";
import FailureChips from "../components/FailureChips";
import HintLadder from "../components/HintLadder";
import Balloons from "../components/Balloons";
import ProblemStatement from "../components/ProblemStatement";
import { getSimilarProblems } from "../lib/rating";
import { tracks } from "../lib/tracks";
import {
  SLOT_ORDER,
  generateSet,
  latestAttemptByProblem,
  pickForSlot,
  typicalDifficulty,
  type SlotKind,
  type TrainingSet,
} from "../lib/trainingSet";
import { useT } from "../lib/i18n";

type PanelTabId = "description" | "notes" | "similar" | "attempts";

function Icon({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  list: "M4 6h16M4 12h16M4 18h16",
  chevL: "M15 18l-6-6 6-6",
  chevR: "M9 18l6-6-6-6",
  chevD: "M6 9l6 6 6-6",
  shuffle: "M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5",
  upload: "M16 16l-4-4-4 4M12 12v9M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3",
  check: "M20 6L9 17l-5-5",
  bulb: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z",
  x: "M18 6L6 18M6 6l12 12",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  history: "M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l4 2",
  expand: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
  restore: "M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8",
};

export default function Practice() {
  const t = useT();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selected, setSelected] = useState<Problem | null>(null);
  const [language, setLanguage] = usePersistentState<"cpp" | "java">(
    "airlock.practice.lang",
    localStorage.getItem("airlock.defaultLang") === "java" ? "java" : "cpp"
  );
  // Editor content lives inside Monaco, not React state: keystrokes never
  // re-render the page. Submit/run pull the text through the handle.
  const editorRef = useRef<CodeEditorHandle>(null);
  const [editorSeed, setEditorSeed] = useState(() => ({
    key: 0,
    value: templateFor(
      localStorage.getItem("airlock.defaultLang") === "java" ? "java" : "cpp",
      localStorage.getItem("airlock.practiceTemplate") === "standard" ? "standard" : "analysis"
    ),
  }));
  const [report, setReport] = useState<JudgeReport | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [judging, setJudging] = useState(false);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [historySubs, setHistorySubs] = useState<Submission[]>([]);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [attempts, setAttempts] = useState<Submission[]>([]);
  const [balloonTrigger, setBalloonTrigger] = useState(0);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [submitSeq, setSubmitSeq] = useState(0);
  const [running, setRunning] = useState(false);
  const [lastWasSubmit, setLastWasSubmit] = useState(true);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [setMode, setSetMode] = useState(false);
  const [setPicks, setSetPicks] = useState<TrainingSet | null>(null);
  const [setSubs, setSetSubs] = useState<Submission[]>([]);
  const [reviewDays, setReviewDays] = useState(() =>
    Number(localStorage.getItem("airlock.reviewDays") || 10)
  );
  const [dueReimpl, setDueReimpl] = useState<ReimplementationSchedule[]>([]);
  const [reimplHideNotesFor, setReimplHideNotesFor] = useState<string | null>(null);
  // Panel focus mode: one panel takes the full workspace like LeetCode expand.
  const [focusedPanel, setFocusedPanel] = useState<null | "left" | "right" | "console">(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && focusedPanel) setFocusedPanel(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedPanel]);

  function toggleFocus(panel: "left" | "right" | "console") {
    setFocusedPanel((prev) => (prev === panel ? null : panel));
  }

  // Workspace chrome state (persisted: tab switches unmount the page)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelTab, setPanelTab] = usePersistentState<PanelTabId>("airlock.practice.panelTab", "description");
  const [consoleOpen, setConsoleOpen] = usePersistentState("airlock.practice.consoleOpen", true);
  const [consoleTab, setConsoleTab] = usePersistentState<"testcase" | "result">("airlock.practice.consoleTab", "testcase");
  const ladderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listProblems().then(setProblems).catch(console.error);
    api.listTechniques().then(setTechniques).catch(() => setTechniques([]));
    api.listSubmissions().then(setHistorySubs).catch(() => {});
    void refreshDue();
  }, []);

  // Restore the previously open problem after tab switches (which unmount
  // this page) and restarts.
  useEffect(() => {
    if (selected || problems.length === 0) return;
    try {
      const id = localStorage.getItem("airlock.practice.selected");
      const p = id ? problems.find((x) => x.id === id) : undefined;
      if (p) openProblem(p, false);
    } catch {
      // storage unavailable: stay on the empty state
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems]);

  useEffect(() => {
    try {
      if (selected) localStorage.setItem("airlock.practice.selected", selected.id);
    } catch {
      // ignore
    }
  }, [selected?.id]);

  useEffect(() => {
    setNotes(selected?.notes_md || "");
    setHintsRevealed(0);
    setConsoleTab("testcase");
    if (selected) {
      api.listSubmissionsByProblem(selected.id).then(setAttempts).catch(() => setAttempts([]));
    } else {
      setAttempts([]);
    }
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    if (notes === (selected.notes_md || "")) return;
    setNotesSaving(true);
    const timeout = setTimeout(async () => {
      try {
        await api.updateProblemNotes(selected.id, notes);
        setProblems((prev) => prev.map((p) => (p.id === selected.id ? { ...p, notes_md: notes } : p)));
        setSelected((prev) => (prev ? { ...prev, notes_md: notes } : prev));
      } catch (e) {
        console.error(e);
      } finally {
        setNotesSaving(false);
      }
    }, 900);
    return () => clearTimeout(timeout);
  }, [notes]);

  const allTags = Array.from(new Set(problems.flatMap((p) => p.tags))).sort();
  const progressByProblem = useMemo(() => {
    const map = new Map<string, "solved" | "attempted">();
    for (const s of historySubs) {
      if (s.verdict === "Accepted") map.set(s.problem_id, "solved");
      else if (!map.has(s.problem_id)) map.set(s.problem_id, "attempted");
    }
    return map;
  }, [historySubs]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return problems.filter((p) => {
      if (tagFilter !== "all" && !p.tags.includes(tagFilter)) return false;
      if (q && !`${p.title} ${p.source} ${p.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [problems, tagFilter, search]);

  useEffect(() => {
    api.listSubmissions().then(setHistorySubs).catch(() => {});
  }, [submitSeq]);

  const typical = useMemo(() => typicalDifficulty(problems), [problems]);
  const latestAttempt = useMemo(() => latestAttemptByProblem(setSubs), [setSubs]);

  async function refreshDue() {
    try {
      setDueReimpl(await api.listDueReimplementations());
    } catch (e) {
      console.error(e);
    }
  }

  const dueWithTitles = useMemo(() => {
    const byId = new Map(problems.map((p) => [p.id, p]));
    return dueReimpl.flatMap((schedule) => {
      const problem = byId.get(schedule.problem_id);
      return problem ? [{ schedule, problem }] : [];
    });
  }, [dueReimpl, problems]);

  const solved = attempts.some((s) => s.verdict === "Accepted");
  const similar = selected ? getSimilarProblems(selected, problems) : [];
  const techniqueOfSelected = selected?.primary_technique_id
    ? techniques.find((x) => x.id === selected.primary_technique_id) ?? null
    : null;
  async function handleSubmit() {
    if (!selected || judging || running) return;
    setJudging(true);
    setReport(null);
    setSubmitError(null);
    setLastWasSubmit(true);
    setSubmitSeq((v) => v + 1);
    try {
      const result = await api.submitSolution({
        problemId: selected.id,
        language,
        sourceCode: editorRef.current?.getValue() ?? "",
        context: "Practice",
        hintsRevealed: hintsRevealed > 0 ? hintsRevealed : null,
      });
      setReport(result);
      setConsoleTab("result");
      setConsoleOpen(true);
      if (result.overall_verdict === "Accepted") setBalloonTrigger((v) => v + 1);
      if (selected) {
        api.listSubmissionsByProblem(selected.id).then(setAttempts).catch(() => {});
      }
    } catch (e) {
      console.error(e);
      setSubmitError(String(e));
      setConsoleTab("result");
      setConsoleOpen(true);
    } finally {
      setJudging(false);
      setReimplHideNotesFor(null);
      void refreshDue();
    }
  }

  async function handleRun() {
    if (!selected || judging || running) return;
    setRunning(true);
    setReport(null);
    setSubmitError(null);
    try {
      const result = await api.runSolution({
        problemId: selected.id,
        language,
        sourceCode: editorRef.current?.getValue() ?? "",
      });
      setReport(result);
      setLastWasSubmit(false);
      setConsoleTab("result");
      setConsoleOpen(true);
    } catch (e) {
      console.error(e);
      setSubmitError(String(e));
      setConsoleTab("result");
      setConsoleOpen(true);
    } finally {
      setRunning(false);
    }
  }

  function openProblem(p: Problem, fresh: boolean) {
    const set = localStorage.getItem("airlock.practiceTemplate") === "standard" ? "standard" : "analysis";
    if (selected && selected.id !== p.id) {
      saveDraft(selected.id, language, editorRef.current?.getValue() ?? "");
    }
    setSelected(p);
    setReport(null);
    // Reimplementation mode starts from the bare template; otherwise resume
    // the saved draft or start from the template. The seed remounts the
    // editor so Submit always reads what is on screen.
    setEditorSeed((s) => ({
      key: s.key + 1,
      value: fresh ? templateFor(language, set) : (loadDraft(p.id, language) ?? templateFor(language, set)),
    }));
    setReimplHideNotesFor(fresh ? p.id : null);
    setDrawerOpen(false);
  }

  function stepProblem(dir: 1 | -1) {
    if (problems.length === 0 || !selected) return;
    const i = problems.findIndex((p) => p.id === selected.id);
    const next = problems[(i + dir + problems.length) % problems.length];
    openProblem(next, false);
  }

  function shuffleProblem() {
    if (problems.length < 2) return;
    const pool = selected ? problems.filter((p) => p.id !== selected.id) : problems;
    openProblem(pool[Math.floor(Math.random() * pool.length)], false);
  }

  function revealNextHint() {
    if (!selected) return;
    const total = Math.min(selected.hints?.length ?? 0, 7);
    if (hintsRevealed < total) {
      setHintsRevealed(hintsRevealed + 1);
      requestAnimationFrame(() =>
        ladderRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      );
    }
  }

  async function handleEnterSetMode() {
    setSetMode(true);
    try {
      const subs = await api.listSubmissions();
      setSetSubs(subs);
      setSetPicks(generateSet(problems, techniques, subs, Date.now(), reviewDays, []));
    } catch (e) {
      console.error(e);
      setSetPicks(generateSet(problems, techniques, [], Date.now(), reviewDays, []));
    }
  }

  function handleNewSet() {
    setSetPicks(generateSet(problems, techniques, setSubs, Date.now(), reviewDays, []));
  }

  function handleReroll(slot: SlotKind) {
    setSetPicks((prev) => {
      if (!prev) return prev;
      const others = new Set<string>();
      (Object.keys(prev) as SlotKind[]).forEach((k) => {
        if (prev[k]) others.add(prev[k]!.id);
      });
      const p = pickForSlot(slot, problems, techniques, latestAttempt, Date.now(), reviewDays, typical, others);
      return { ...prev, [slot]: p ?? prev[slot] };
    });
  }

  function handleReviewDays(days: number) {
    if (isNaN(days) || days < 1) return;
    setReviewDays(days);
    localStorage.setItem("airlock.reviewDays", String(days));
    setSetPicks(generateSet(problems, techniques, setSubs, Date.now(), days, []));
  }

  function handleToggleSetMode() {
    if (setMode) {
      setSetMode(false);
      setSetPicks(null);
    } else {
      void handleEnterSetMode();
    }
  }

  function slotReason(slot: SlotKind, problem: Problem): string {
    const tech = problem.primary_technique_id
      ? techniques.find((x) => x.id === problem.primary_technique_id)
      : null;
    switch (slot) {
      case "confidence":
        return t("set.reasonConfidence").replace("{technique}", tech?.name ?? "?");
      case "target":
        return t("set.reasonTarget").replace("{technique}", tech?.name ?? "?");
      case "stretch":
        return t("set.reasonStretch")
          .replace("{difficulty}", String(problem.difficulty))
          .replace("{typical}", String(typical));
      case "review": {
        const last = latestAttempt.get(problem.id);
        const days = last ? Math.max(0, Math.floor((Date.now() - last) / 86400000)) : reviewDays;
        return t("set.reasonReview").replace("{days}", String(days));
      }
    }
  }

  function overdueText(nextDueAt: string): string {
    const days = Math.floor((Date.now() - new Date(nextDueAt).getTime()) / 86400000);
    if (days <= 0) return t("reimpl.dueToday");
    return t("reimpl.overdue").replace("{days}", String(days));
  }

  const hintTotal = Math.min(selected?.hints?.length ?? 0, 7);

  return (
    <div className="flex flex-col h-full bg-background">
      <Balloons trigger={balloonTrigger} />

      {/* Workspace toolbar */}
      <div className="relative flex items-center gap-1 px-3 h-11 border-b border-border shrink-0 bg-background">
        <ToolButton title={t("workspace.problemList")} onClick={() => setDrawerOpen(true)} tourId="open-problems">
          <Icon d={ICONS.list} size={16} />
        </ToolButton>
        <span className="text-[13px] font-medium mr-1 hidden sm:inline">{t("workspace.problemList")}</span>
        <div className="h-5 w-px bg-border mx-1" />
        <ToolButton title={t("workspace.prev")} onClick={() => stepProblem(-1)} disabled={!selected}>
          <Icon d={ICONS.chevL} />
        </ToolButton>
        <ToolButton title={t("workspace.next")} onClick={() => stepProblem(1)} disabled={!selected}>
          <Icon d={ICONS.chevR} />
        </ToolButton>
        <ToolButton title={t("workspace.shuffle")} onClick={shuffleProblem} disabled={problems.length < 2}>
          <Icon d={ICONS.shuffle} />
        </ToolButton>
        <div data-tour="run-submit" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          <Button
            onClick={handleRun}
            disabled={judging || running || !selected}
            variant="ghost"
            size="md"
            className="h-8 px-3 gap-1.5"
            title={t("workspace.runHint")}
          >
            {running ? (
              <Spinner />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            {t("workspace.run")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={judging || running || !selected}
            variant="success"
            size="md"
            className="h-8 px-5 gap-1.5"
          >
            {judging ? (
              <>
                <Spinner />
                {t("practice.judging")}
              </>
            ) : (
              <>
                <Icon d={ICONS.upload} size={14} />
                {t("practice.submit")}
              </>
            )}
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ToolButton
            title={consoleOpen ? t("workspace.collapseConsole") : t("workspace.expandConsole")}
            onClick={() => setConsoleOpen((v) => !v)}
            disabled={!selected}
          >
            <span className={`inline-block transition-transform duration-200 ${consoleOpen ? "" : "rotate-180"}`}>
              <Icon d={ICONS.chevD} />
            </span>
          </ToolButton>
        </div>
      </div>

      {/* Problem drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[380px] max-w-[90vw] bg-background border-r border-border flex flex-col animate-drawer-in rounded-r-xl overflow-hidden">
            <div className="p-4 border-b border-border/50 shrink-0 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold flex-1">{t("workspace.problemList")}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {visible.length}/{problems.length}
                </span>
                <ToolButton title={t("common.close")} onClick={() => setDrawerOpen(false)}>
                  <Icon d={ICONS.x} />
                </ToolButton>
              </div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("workspace.search")}
                className="h-9"
              />
              <div className="flex gap-2">
                <Select className="flex-1" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                  <option value="all">{t("practice.allTags")}</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </Select>
                <Button
                  variant={setMode ? "primary" : "secondary"}
                  size="sm"
                  className="shrink-0"
                  onClick={handleToggleSetMode}
                >
                  {setMode ? t("set.clear") : t("set.button")}
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {setMode && setPicks ? (
                <div className="p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={handleNewSet} className="flex-1">
                      {t("set.new")}
                    </Button>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                      {t("set.reviewDays")}
                      <input
                        type="number"
                        min={1}
                        value={reviewDays}
                        onChange={(e) => handleReviewDays(Number(e.target.value))}
                        className="w-14 bg-input border border-border rounded-md px-2 py-1 text-xs text-foreground"
                      />
                    </label>
                  </div>
                  {SLOT_ORDER.map((slot) => {
                    const pick = setPicks[slot];
                    const active = pick && selected?.id === pick.id;
                    return (
                      <div
                        key={slot}
                        className={`rounded-lg border bg-card p-3 transition-colors duration-150 ${active ? "border-ac/40" : "border-border"}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                            {t(`set.slot.${slot}`)}
                          </span>
                          <button
                            onClick={() => handleReroll(slot)}
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {t("set.reroll")}
                          </button>
                        </div>
                        {pick ? (
                          <button onClick={() => openProblem(pick, false)} className="w-full text-left group">
                            <div className="font-medium text-sm leading-tight truncate group-hover:text-foreground transition-colors">
                              {pick.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {slotReason(slot, pick)}
                            </div>
                          </button>
                        ) : (
                          <div className="text-xs text-muted-foreground">{t("set.emptySlot")}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {dueWithTitles.length > 0 && (
                    <div className="px-3 py-2 border-b border-white/[0.04]">
                      <div className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-1">
                        {t("reimpl.title")}
                      </div>
                      <ul className="space-y-0.5">
                        {dueWithTitles.map(({ schedule, problem }) => (
                          <li key={schedule.problem_id}>
                            <button
                              onClick={() => openProblem(problem, true)}
                              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-white/[0.03] flex items-center gap-2 transition-colors"
                            >
                              <span className="flex-1 min-w-0 text-xs font-medium truncate">
                                {problem.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                {overdueText(schedule.next_due_at)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {visible.length === 0 ? (
                    <div className="m-4 text-xs text-muted-foreground py-8 text-center border border-dashed border-border rounded-lg">
                      {t("workspace.none")}
                    </div>
                  ) : (
                    <ul className="p-2 space-y-1">
                      {visible.map((p) => {
                        const progress = progressByProblem.get(p.id);
                        const isActive = selected?.id === p.id;
                        return (
                          <li key={p.id}>
                            <button
                              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all duration-150 ease-[cubic-bezier(0.2,0,0,1)] group border ${
                                isActive
                                  ? "bg-white/[0.06] border-ac/40"
                                  : "bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.06]"
                              }`}
                              onClick={() => openProblem(p, false)}
                            >
                              <span
                                className={`h-2 w-2 rounded-full shrink-0 ${
                                  progress === "solved"
                                    ? "bg-ac"
                                    : progress === "attempted"
                                      ? "bg-tle"
                                      : "bg-white/15"
                                }`}
                                title={
                                  progress === "solved"
                                    ? t("workspace.solved")
                                    : progress === "attempted"
                                      ? t("workspace.attempted")
                                      : undefined
                                }
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm leading-snug truncate">
                                  {p.title}
                                </div>
                                <div className="text-xs text-muted-foreground truncate mt-0.5">
                                  {p.source}
                                  {p.tags.length > 0 && ` · ${p.tags.slice(0, 2).join(", ")}`}
                                </div>
                              </div>
                              <DifficultyBadge difficulty={p.difficulty} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Workspace panes */}
      {selected ? (
        <div className="flex-1 min-h-0 p-2">
          <SplitView
            storageKey="practice-split"
            left={
              <div className="h-full pr-1">
                <div className={`h-full rounded-lg border border-border bg-card overflow-hidden flex flex-col ${focusedPanel === "left" ? "fixed inset-2 z-[70]" : ""}`}>
                  <PanelTabs
                    active={panelTab}
                    onChange={(id) => setPanelTab(id as PanelTabId)}
                    actions={
                      <ToolButton
                        title={focusedPanel === "left" ? t("editor.unfocusPanel") : t("editor.focusPanel")}
                        onClick={() => toggleFocus("left")}
                      >
                        <Icon d={focusedPanel === "left" ? ICONS.restore : ICONS.expand} size={14} />
                      </ToolButton>
                    }
                    tabs={[
                      { id: "description", label: t("workspace.description"), icon: <Icon d={ICONS.file} size={14} /> },
                      { id: "notes", label: t("workspace.notes"), icon: <Icon d={ICONS.book} size={14} /> },
                      { id: "similar", label: t("workspace.similar"), icon: <Icon d={ICONS.layers} size={14} /> },
                      {
                        id: "attempts",
                        label: t("workspace.attempts"),
                        icon: <Icon d={ICONS.history} size={14} />,
                        badge: attempts.length > 0 ? (
                          <span className="text-[10px] tabular-nums bg-white/[0.08] rounded-full px-1.5 py-px">
                            {attempts.length}
                          </span>
                        ) : null,
                      },
                    ]}
                  />
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {panelTab === "description" && (
                      <div key={selected.id} className="p-5 animate-panel-in">
                        <div className="flex items-start gap-3">
                          <h1 className="text-lg font-semibold leading-snug flex-1">{selected.title}</h1>
                          {solved && (
                            <span className="flex items-center gap-1 text-xs font-medium text-ac shrink-0 mt-1">
                              <Icon d={ICONS.check} size={13} />
                              {t("workspace.solved")}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5 mt-2.5 flex-wrap items-center">
                          <DifficultyBadge difficulty={selected.difficulty} />
                          {selected.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                          <Badge variant="outline">{selected.source}</Badge>
                          {techniqueOfSelected && (
                            <Badge variant="outline">{techniqueOfSelected.name}</Badge>
                          )}
                          {hintTotal > 0 && (
                            <button
                              onClick={revealNextHint}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all duration-150 active:scale-95"
                            >
                              <Icon d={ICONS.bulb} size={12} />
                              {t("workspace.hint")} {hintsRevealed}/{hintTotal}
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2.5 tabular-nums">
                          {t("practice.timeLimit")}: {selected.time_limit_ms}ms · {t("practice.memory")}:{" "}
                          {selected.memory_limit_mb}MB
                        </div>
                        <div className="mt-4">
                          <ProblemStatement content={selected.statement_md} />
                        </div>
                        {selected.tests.length > 0 && (
                          <div className="mt-6">
                            <div className="text-sm font-semibold mb-2">{t("workspace.examples")}</div>
                            <div className="space-y-2">
                              {selected.tests.map((tc, i) => (
                                <div key={tc.id || i} className="rounded-lg border border-white/[0.06] overflow-hidden">
                                  <div className="px-3 py-1.5 text-xs font-semibold bg-white/[0.02] border-b border-white/[0.06]">
                                    {t("workspace.example")} {i + 1}
                                  </div>
                                  <div className="p-3 grid gap-2">
                                    <div>
                                      <span className="text-xs font-semibold text-muted-foreground">{t("workspace.exampleInput")}: </span>
                                      <pre className="mt-1 bg-black/30 rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-white/[0.04] font-mono">
                                        {tc.input || t("common.empty")}
                                      </pre>
                                    </div>
                                    <div>
                                      <span className="text-xs font-semibold text-muted-foreground">{t("workspace.exampleOutput")}: </span>
                                      <pre className="mt-1 bg-black/30 rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-white/[0.04] font-mono">
                                        {tc.expected_output || t("common.empty")}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {selected.hints && selected.hints.length > 0 && (
                          <div ref={ladderRef} className="scroll-mt-4">
                            <HintLadder
                              key={selected.id}
                              hints={selected.hints}
                              revealed={hintsRevealed}
                              onReveal={setHintsRevealed}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {panelTab === "notes" && (
                      <div key={`notes-${selected.id}`} className="p-5 h-full flex flex-col animate-panel-in">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold">{t("practice.myNotes")}</span>
                          <span className="text-xs text-muted-foreground">
                            {notesSaving ? t("practice.saving") : notes ? t("practice.saved") : t("practice.noNotes")}
                          </span>
                        </div>
                        {reimplHideNotesFor === selected.id ? (
                          <div className="text-xs text-muted-foreground">{t("workspace.notesHidden")}</div>
                        ) : (
                          <>
                            <Textarea
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder={t("practice.notesPlaceholder")}
                              className="flex-1 min-h-[240px] font-sans text-sm"
                            />
                            <div className="text-xs text-muted-foreground mt-2">
                              {t("practice.autosavedHint")}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {panelTab === "similar" && (
                      <div key={`similar-${selected.id}`} className="p-4 animate-panel-in">
                        {similar.length === 0 && tracks.length === 0 && (
                          <div className="text-xs text-muted-foreground p-2">{t("workspace.none")}</div>
                        )}
                        {similar.length > 0 && (
                          <div className="space-y-0.5 mb-4">
                            {similar.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => openProblem(p, false)}
                                className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/[0.04] text-sm flex justify-between items-center gap-2 transition-colors duration-150"
                              >
                                <span className="truncate">{p.title}</span>
                                <DifficultyBadge difficulty={p.difficulty} />
                              </button>
                            ))}
                          </div>
                        )}
                        {tracks.slice(0, 2).map((tr) => (
                          <div key={tr.id} className="border border-border rounded-lg p-3 mb-2">
                            <div className="text-xs font-medium">{t(`tracks.${tr.id}.title`)}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {t(`tracks.${tr.id}.description`)}
                            </div>
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {tr.steps.map((s) => (
                                <Badge key={s.title} variant="outline">
                                  {s.title}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {panelTab === "attempts" && (
                      <div key={`attempts-${selected.id}`} className="p-4 space-y-1 animate-panel-in">
                        {attempts.length === 0 && (
                          <div className="text-xs text-muted-foreground p-2">{t("workspace.none")}</div>
                        )}
                        {attempts.map((a) => (
                          <details
                            key={a.id}
                            className="rounded-lg border border-white/[0.04] open:border-white/[0.06] open:bg-white/[0.02] transition-colors duration-150"
                          >
                            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer list-none text-xs">
                              <VerdictBadge verdict={a.verdict} />
                              <span className="text-muted-foreground tabular-nums">
                                {new Date(a.submitted_at).toLocaleString()}
                              </span>
                              <span className="ml-auto font-mono">{a.language}</span>
                            </summary>
                            <div className="px-3 pb-3">
                              {(a.failure_category || (a.hints_revealed != null && a.hints_revealed > 0)) && (
                                <div className="text-[11px] text-muted-foreground mb-2">
                                  {a.failure_category && t(`failure.${a.failure_category}`)}
                                  {a.failure_category && a.hints_revealed ? " · " : ""}
                                  {a.hints_revealed != null && a.hints_revealed > 0 &&
                                    t("history.hintsUsed").replace("{count}", String(a.hints_revealed))}
                                </div>
                              )}
                              <pre className="bg-black/40 border border-border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-words max-h-64 overflow-auto">
                                {a.source_code}
                              </pre>
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            }
            right={
              <div className={`h-full pl-1 flex flex-col min-h-0 gap-2 ${focusedPanel === "right" ? "fixed inset-2 z-[70] bg-background p-2 pr-3 rounded-xl" : ""}`}>
                {focusedPanel !== "right" && (
                  <div className="pl-1 pr-2 shrink-0">
                    <FirstWeekChecklist refreshKey={submitSeq} />
                  </div>
                )}
                <div data-tour="editor" className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden">
                  <LazyCodeEditor
                    ref={editorRef}
                    language={language}
                    initialValue={editorSeed.value}
                    editorKey={editorSeed.key}
                    onLanguageChange={setLanguage}
                    onContentChange={(v) => saveDraft(selected.id, language, v)}
                    onToggleFocus={() => toggleFocus("right")}
                    focused={focusedPanel === "right"}
                    draftScope={selected.id}
                    templateSet={
                      localStorage.getItem("airlock.practiceTemplate") === "standard"
                        ? "standard"
                        : "analysis"
                    }
                  />
                </div>
                {focusedPanel === "console" ? (
                  <div className="fixed inset-2 z-[70] bg-background p-2 rounded-xl flex flex-col min-h-0">
                    <ResultConsole
                      tests={selected.tests}
                      timeLimitMs={selected.time_limit_ms}
                      report={report}
                      submitSeq={submitSeq}
                      lastWasSubmit={lastWasSubmit}
                      tab={consoleTab}
                      onTabChange={setConsoleTab}
                      busy={judging || running}
                      runError={submitError}
                      open
                      onToggleOpen={() => setConsoleOpen((v) => !v)}
                      expanded
                      onToggleExpand={() => toggleFocus("console")}
                      expandTitle={t("editor.focusPanel")}
                      restoreTitle={t("editor.unfocusPanel")}
                      failureSlot={
                        lastWasSubmit && report && report.overall_verdict !== "Accepted" ? (
                          <FailureChips problemId={selected.id} attemptKey={submitSeq} />
                        ) : null
                      }
                    />
                  </div>
                ) : (
                  <ResultConsole
                    tests={selected.tests}
                    timeLimitMs={selected.time_limit_ms}
                    report={report}
                    submitSeq={submitSeq}
                    lastWasSubmit={lastWasSubmit}
                    tab={consoleTab}
                    onTabChange={setConsoleTab}
                    busy={judging || running}
                    runError={submitError}
                    open={consoleOpen}
                    onToggleOpen={() => setConsoleOpen((v) => !v)}
                    expanded={false}
                    onToggleExpand={() => toggleFocus("console")}
                    expandTitle={t("editor.focusPanel")}
                    restoreTitle={t("editor.unfocusPanel")}
                    failureSlot={
                      lastWasSubmit && report && report.overall_verdict !== "Accepted" ? (
                        <FailureChips problemId={selected.id} attemptKey={submitSeq} />
                      ) : null
                    }
                  />
                )}
              </div>
            }
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-4 overflow-y-auto">
          <div className="w-full max-w-md">
            <FirstWeekChecklist refreshKey={submitSeq} />
          </div>
          <span className="text-sm mt-2">{t("practice.selectProblem")}</span>
          <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)}>
            {t("workspace.problemList")}
          </Button>
        </div>
      )}
    </div>
  );
}
