import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { loadDraft, saveDraft } from "../lib/drafts";
import { templateFor } from "../lib/templates";
import type { JudgeReport, Problem, ReimplementationSchedule, Submission, Technique } from "../lib/types";
import { getVerdictInfo } from "../lib/verdict";
import CodeEditor from "../components/CodeEditor";
import VerdictBadge from "../components/VerdictBadge";
import { Badge, DifficultyBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { SplitView } from "../components/ui/split-view";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { PanelTabs, ToolButton } from "../components/PanelTabs";
import DiffViewer from "../components/DiffViewer";
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
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8",
};

export default function Practice() {
  const t = useT();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selected, setSelected] = useState<Problem | null>(null);
  const [language, setLanguage] = useState<"cpp" | "java">(() =>
    localStorage.getItem("airlock.defaultLang") === "java" ? "java" : "cpp"
  );
  const [code, setCode] = useState("");
  const [report, setReport] = useState<JudgeReport | null>(null);
  const [judging, setJudging] = useState(false);
  const [tagFilter, setTagFilter] = useState<string>("all");
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
  // Workspace chrome state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTabId>("description");
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleTab, setConsoleTab] = useState<"testcase" | "result">("testcase");
  const [expandedCase, setExpandedCase] = useState<number | null>(null);
  const ladderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listProblems().then(setProblems).catch(console.error);
    api.listTechniques().then(setTechniques).catch(() => setTechniques([]));
    void refreshDue();
  }, []);

  useEffect(() => {
    setNotes(selected?.notes_md || "");
    setHintsRevealed(0);
    setExpandedCase(null);
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
  const visible =
    tagFilter === "all" ? problems : problems.filter((p) => p.tags.includes(tagFilter));

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
  const failCount = report && report.overall_verdict !== "Accepted"
    ? report.tests_total - report.tests_passed
    : 0;

  async function handleSubmit() {
    if (!selected || judging || running) return;
    setJudging(true);
    setReport(null);
    setLastWasSubmit(true);
    setSubmitSeq((v) => v + 1);
    try {
      const result = await api.submitSolution({
        problemId: selected.id,
        language,
        sourceCode: code,
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
    try {
      const result = await api.runSolution({
        problemId: selected.id,
        language,
        sourceCode: code,
      });
      setReport(result);
      setLastWasSubmit(false);
      setConsoleTab("result");
      setConsoleOpen(true);
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  }

  function openProblem(p: Problem, fresh: boolean) {
    const set = localStorage.getItem("airlock.practiceTemplate") === "standard" ? "standard" : "analysis";
    if (selected && selected.id !== p.id) {
      saveDraft(selected.id, language, code);
    }
    setSelected(p);
    setReport(null);
    // Reimplementation mode starts from the bare template; otherwise resume
    // the saved draft or start from the template. State always holds real
    // code so Submit never sends an empty buffer behind a template display.
    setCode(fresh ? templateFor(language, set) : (loadDraft(p.id, language) ?? templateFor(language, set)));
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
        <ToolButton title={t("workspace.problemList")} onClick={() => setDrawerOpen(true)}>
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
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          <Button
            onClick={handleRun}
            disabled={judging || running || !selected}
            variant="ghost"
            size="md"
            className="h-8 px-3 gap-1.5"
            title={t("workspace.runHint")}
          >
            {running ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.2-8.56" />
              </svg>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.2-8.56" />
                </svg>
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
          <aside className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-background border-r border-border flex flex-col animate-drawer-in">
            <div className="p-3 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold flex-1">{t("workspace.problemList")}</span>
                <ToolButton title={t("common.close")} onClick={() => setDrawerOpen(false)}>
                  <Icon d={ICONS.x} />
                </ToolButton>
              </div>
              <Select className="w-full" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                <option value="all">{t("practice.allTags")}</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </Select>
              <div className="flex items-center justify-between mt-3 px-1">
                <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                  {visible.length} problems
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{problems.length} total</span>
              </div>
              <Button
                variant={setMode ? "primary" : "secondary"}
                size="sm"
                className="w-full mt-3"
                onClick={handleToggleSetMode}
              >
                {setMode ? t("set.clear") : t("set.button")}
              </Button>
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
                  <div className="px-3 py-2 flex items-center text-xs font-medium text-muted-foreground tracking-wide uppercase border-b border-white/[0.04]">
                    <span className="flex-1">Title</span>
                    <span className="w-24 text-right">Difficulty</span>
                  </div>
                  <ul className="divide-y divide-white/[0.04]">
                    {visible.map((p) => (
                      <li key={p.id}>
                        <button
                          className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-all duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:translate-x-0.5 group ${
                            selected?.id === p.id
                              ? "bg-white/[0.06] border-l-2 border-l-ac"
                              : "hover:bg-white/[0.03] border-l-2 border-l-transparent hover:border-l-white/[0.08]"
                          }`}
                          onClick={() => openProblem(p, false)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm leading-tight truncate group-hover:text-foreground transition-colors">
                              {p.title}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">{p.source}</div>
                          </div>
                          <DifficultyBadge difficulty={p.difficulty} />
                        </button>
                      </li>
                    ))}
                  </ul>
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
                <div className="h-full rounded-lg border border-border bg-card overflow-hidden flex flex-col">
                  <PanelTabs
                    active={panelTab}
                    onChange={(id) => setPanelTab(id as PanelTabId)}
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
                          <h1 className="text-[15px] font-semibold leading-tight flex-1">{selected.title}</h1>
                          {solved && (
                            <span className="flex items-center gap-1 text-xs font-medium text-ac shrink-0 mt-0.5">
                              <Icon d={ICONS.check} size={13} />
                              {t("workspace.solved")}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5 mt-3 flex-wrap items-center">
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
                        <div className="text-xs text-muted-foreground mt-3 tabular-nums">
                          {t("practice.timeLimit")}: {selected.time_limit_ms}ms · {t("practice.memory")}:{" "}
                          {selected.memory_limit_mb}MB
                        </div>
                        <div className="mt-4">
                          <ProblemStatement content={selected.statement_md} />
                        </div>
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
              <div className="h-full pl-1 flex flex-col min-h-0 gap-2">
                <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden">
                  <CodeEditor
                    language={language}
                    value={code}
                    onChange={setCode}
                    onLanguageChange={setLanguage}
                    draftScope={selected.id}
                    templateSet={
                      localStorage.getItem("airlock.practiceTemplate") === "standard"
                        ? "standard"
                        : "analysis"
                    }
                  />
                </div>
                <div
                  className={`rounded-lg border border-border bg-card overflow-hidden shrink-0 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
                    consoleOpen ? "h-64" : "h-11"
                  }`}
                >
                  <div className="flex items-center gap-0.5 px-2 h-11 border-b border-border shrink-0">
                    {(["testcase", "result"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => {
                          setConsoleTab(tab);
                          setConsoleOpen(true);
                        }}
                        className={`relative flex items-center gap-1.5 px-2.5 h-11 text-[13px] font-medium transition-colors duration-150 ${
                          consoleTab === tab && consoleOpen
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab === "result" && (
                          <span className={failCount > 0 ? "text-wa" : "text-ac"}>
                            <Icon d={failCount > 0 ? ICONS.x : ICONS.check} size={13} />
                          </span>
                        )}
                        {t(`workspace.${tab === "testcase" ? "testcase" : "testresult"}`)}
                        {tab === "result" && failCount > 0 && (
                          <span className="text-[10px] tabular-nums bg-wa/15 text-wa rounded-full px-1.5 py-px">
                            {failCount}
                          </span>
                        )}
                        <span
                          className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-foreground transition-transform duration-200 ${
                            consoleTab === tab && consoleOpen ? "scale-x-100" : "scale-x-0"
                          }`}
                        />
                      </button>
                    ))}
                    <div className="ml-auto">
                      <ToolButton
                        title={consoleOpen ? t("workspace.collapseConsole") : t("workspace.expandConsole")}
                        onClick={() => setConsoleOpen((v) => !v)}
                      >
                        <span className={`inline-block transition-transform duration-200 ${consoleOpen ? "" : "rotate-180"}`}>
                          <Icon d={ICONS.chevD} />
                        </span>
                      </ToolButton>
                    </div>
                  </div>
                  {consoleOpen && (
                    <div className="h-[calc(100%-2.75rem)] overflow-y-auto p-3 animate-fade-in">
                      {consoleTab === "testcase" && (
                        <div className="space-y-1">
                          {selected.tests.length === 0 && (
                            <div className="text-xs text-muted-foreground">{t("workspace.none")}</div>
                          )}
                          {selected.tests.map((tc, i) => (
                            <div key={tc.id || i} className="rounded-lg border border-white/[0.04]">
                              <button
                                onClick={() => setExpandedCase(expandedCase === i ? null : i)}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs cursor-pointer"
                              >
                                <span className="font-medium tracking-wide uppercase text-muted-foreground">
                                  {t("workspace.case")} {i + 1}
                                </span>
                                <span className="font-mono text-muted-foreground truncate max-w-[60%]">
                                  {tc.input.split("\n")[0]}
                                </span>
                              </button>
                              {expandedCase === i && (
                                <div className="px-3 pb-3 grid gap-2 animate-fade-in">
                                  <div>
                                    <div className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">
                                      {t("common.input")}
                                    </div>
                                    <pre className="bg-white/[0.02] rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-white/[0.04] font-mono">
                                      {tc.input || t("common.empty")}
                                    </pre>
                                  </div>
                                  <div>
                                    <div className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">
                                      {t("common.expectedOutput")}
                                    </div>
                                    <pre className="bg-white/[0.02] rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-white/[0.04] font-mono">
                                      {tc.expected_output || t("common.empty")}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {consoleTab === "result" && (
                        <>
                          {!report ? (
                            <div className="text-xs text-muted-foreground">{t("workspace.noResult")}</div>
                          ) : (
                            <div key={submitSeq} className="animate-pop">
                              {(() => {
                                const info = getVerdictInfo(report.overall_verdict);
                                const isCE = report.overall_verdict === "CompileError";
                                const isAC = report.overall_verdict === "Accepted";
                                return (
                                  <>
                                    <div className="flex items-start gap-3 mb-3">
                                      <VerdictBadge verdict={report.overall_verdict} size="lg" showLong />
                                      <div className="flex-1">
                                        <div className="font-semibold text-sm">{t(info.description)}</div>
                                        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                          {t(info.hint)}
                                        </div>
                                      </div>
                                    </div>
                            {!isAC && lastWasSubmit && (
                              <FailureChips problemId={selected.id} attemptKey={submitSeq} />
                            )}
                                    {isCE ? (
                                      <div className="mt-3">
                                        <div className="text-xs font-semibold text-foreground mb-1">
                                          {t("practice.compilerSays")}
                                        </div>
                                        <pre className="bg-black/40 border border-border rounded-lg p-3 text-xs whitespace-pre-wrap break-words max-h-48 overflow-auto font-mono">
                                          {report.results[0]?.message || t("practice.noCompilerDetails")}
                                        </pre>
                                      </div>
                                    ) : (
                                      <div className="space-y-2 mt-3">
                                        <div className="text-xs font-semibold text-foreground">
                                          {report.tests_passed}/{report.tests_total} {t("practice.testsPassed")}
                                          <span className="font-normal text-muted-foreground ml-2">
                                            {t("practice.limit")} {selected.time_limit_ms}ms
                                          </span>
                                          {!isAC && (
                                            <span className="ml-2 text-wa">
                                              • {report.tests_total - report.tests_passed} {t("practice.failedCount")}
                                            </span>
                                          )}
                                        </div>
                                        {report.results.map((r, i) => {
                                          const infoR = getVerdictInfo(r.verdict);
                                          const test =
                                            selected.tests.find((tt) => tt.id === r.test_id) ??
                                            selected.tests[i];
                                          const isFail = r.verdict !== "Accepted";
                                          return (
                                            <details
                                              key={r.test_id}
                                              open={isFail}
                                              className="bg-white/[0.015] rounded-lg border border-white/[0.04] open:border-white/[0.06] open:bg-white/[0.02] animate-fade-in"
                                            >
                                              <summary className="flex items-center justify-between px-3 py-2 cursor-pointer list-none">
                                                <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                                                  {t("practice.test")} {i + 1}
                                                </span>
                                                <span className="flex items-center gap-2">
                                                  <span className="text-xs text-muted-foreground tabular-nums">
                                                    {r.time_ms}ms
                                                  </span>
                                                  <VerdictBadge verdict={r.verdict} />
                                                </span>
                                              </summary>
                                              <div className="px-3 pb-3 pt-2 border-t border-white/[0.04]">
                                                <div className="text-xs text-muted-foreground mb-1">
                                                  {t(infoR.long)}: {t(infoR.description)}
                                                </div>
                                                {test && (
                                                  <div className="grid gap-3 mt-2">
                                                    <div>
                                                      <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">
                                                        {t("common.input")}
                                                      </div>
                                                      <pre className="bg-white/[0.02] rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-white/[0.04] font-mono">
                                                        {test.input || t("common.empty")}
                                                      </pre>
                                                    </div>
                                                    {r.verdict === "WrongAnswer" && r.actual_output != null ? (
                                                      <DiffViewer
                                                        expected={test.expected_output || ""}
                                                        actual={r.actual_output || ""}
                                                      />
                                                    ) : (
                                                      <>
                                                        <div>
                                                          <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">
                                                            {t("common.expectedOutput")}
                                                          </div>
                                                          <pre className="bg-white/[0.02] rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-white/[0.04] font-mono">
                                                            {test.expected_output || t("common.empty")}
                                                          </pre>
                                                        </div>
                                                        {r.actual_output != null && (
                                                          <div>
                                                            <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">
                                                              {t("common.yourOutput")}
                                                            </div>
                                                            <pre
                                                              className={`rounded-md p-2 text-xs whitespace-pre-wrap break-words border font-mono ${
                                                                isFail
                                                                  ? "bg-wa/[0.04] border-wa/20"
                                                                  : "bg-white/[0.02] border-white/[0.04]"
                                                              }`}
                                                            >
                                                              {r.actual_output || t("common.noOutput")}
                                                            </pre>
                                                          </div>
                                                        )}
                                                      </>
                                                    )}
                                                    {r.message && (
                                                      <div>
                                                        <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">
                                                          {t("practice.runtimeOutput")}
                                                        </div>
                                                        <pre className="bg-re/[0.04] border border-re/20 rounded-md p-2 text-xs whitespace-pre-wrap break-words font-mono">
                                                          {r.message}
                                                        </pre>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </details>
                                          );
                                        })}
                                        {isAC && (
                                          <div className="text-xs text-ac mt-2">{t("practice.submittedHint")}</div>
                                        )}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            }
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <span className="text-sm">{t("practice.selectProblem")}</span>
          <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)}>
            {t("workspace.problemList")}
          </Button>
        </div>
      )}
    </div>
  );
}
