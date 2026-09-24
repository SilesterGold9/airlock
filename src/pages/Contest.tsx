import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { loadDraft, saveDraft } from "../lib/drafts";
import { templateFor } from "../lib/templates";
import type { Contest as ContestModel, JudgeReport, Problem } from "../lib/types";
import LazyCodeEditor, { type CodeEditorHandle } from "../components/LazyCodeEditor";
import ResultConsole from "../components/ResultConsole";
import Spinner from "../components/Spinner";
import { usePersistentState } from "../lib/persist";
import VerdictBadge from "../components/VerdictBadge";
import Timer from "../components/Timer";
import { Badge, DifficultyBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { SplitView } from "../components/ui/split-view";
import { PanelTabs, ToolButton, Icon, WS_ICONS } from "../components/PanelTabs";
import FailureChips from "../components/FailureChips";
import ProblemStatement from "../components/ProblemStatement";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import Balloons from "../components/Balloons";
import { useT } from "../lib/i18n";

interface ProblemStatus {
  solved: boolean;
  wrongAttempts: number;
  solvedAtSeconds?: number;
}

type ContestTabId = "description" | "team" | "standings";

const PENALTY_MINUTES = 20;

export default function Contest() {
  const t = useT();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [setup, setSetup] = useState(true);
  const [selectedIds, setSelectedIds] = usePersistentState<string[]>("airlock.contest.selectedIds", []);
  const [durationMinutes, setDurationMinutes] = usePersistentState("airlock.contest.duration", 180);
  const [contestName, setContestName] = usePersistentState("airlock.contest.name", "Virtual Contest");

  const [active, setActive] = useState<Problem[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ProblemStatus>>({});
  const [current, setCurrent] = useState<Problem | null>(null);
  const [language, setLanguage] = usePersistentState<"cpp" | "java">(
    "airlock.contest.lang",
    localStorage.getItem("airlock.defaultLang") === "java" ? "java" : "cpp"
  );
  const editorRef = useRef<CodeEditorHandle>(null);
  const [editorSeed, setEditorSeed] = useState(() => ({
    key: 0,
    value: templateFor(
      localStorage.getItem("airlock.defaultLang") === "java" ? "java" : "cpp",
      "standard"
    ),
  }));
  const [report, setReport] = useState<JudgeReport | null>(null);
  const [judging, setJudging] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [ended, setEnded] = useState(false);
  const [contests, setContests] = useState<ContestModel[]>([]);
  const [viewingHistory, setViewingHistory] = useState<ContestModel | null>(null);
  const [teamMembersStr, setTeamMembersStr] = usePersistentState("airlock.contest.team", "");
  const [driver, setDriver] = useState("");
  const [claims, setClaims] = useState<import("../lib/types").ProblemClaim[]>([]);
  const [activeContestId, setActiveContestId] = useState<string | null>(null);
  const [balloonTrigger, setBalloonTrigger] = useState(0);
  const [submitSeq, setSubmitSeq] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastWasSubmit, setLastWasSubmit] = useState(true);
  const [panelTab, setPanelTab] = useState<ContestTabId>("description");
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleTab, setConsoleTab] = useState<"testcase" | "result">("testcase");
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


  useEffect(() => {
    api.listProblems().then(setProblems).catch(console.error);
  }, []);

  useEffect(() => {
    if (setup) {
      api.listContests().then(setContests).catch(console.error);
    }
  }, [setup]);

  useEffect(() => {
    setConsoleTab("testcase");
  }, [current?.id]);

  const teamList = useMemo(
    () =>
      viewingHistory?.team_members?.length
        ? viewingHistory.team_members
        : teamMembersStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
    [viewingHistory, teamMembersStr]
  );
  const effectiveDriver = viewingHistory?.driver || driver;

  function seedEditor(value: string) {
    setEditorSeed((s) => ({ key: s.key + 1, value }));
  }

  function openContestProblem(p: Problem) {
    if (current && current.id !== p.id) {
      saveDraft(current.id, language, editorRef.current?.getValue() ?? "");
    }
    setCurrent(p);
    setReport(null);
    seedEditor(loadDraft(p.id, language) ?? templateFor(language, "standard"));
  }

  function reviewContest(c: ContestModel) {
    const chosen = problems.filter((p) => c.problem_ids.includes(p.id));
    if (chosen.length === 0) return;
    setActive(chosen);
    setStatuses(Object.fromEntries(chosen.map((p) => [p.id, { solved: false, wrongAttempts: 0 }])));
    setCurrent(chosen[0]);
    seedEditor(loadDraft(chosen[0].id, language) ?? templateFor(language, "standard"));
    setStartTime(c.started_at ? new Date(c.started_at).getTime() : Date.now());
    setViewingHistory(c);
    setDurationMinutes(c.duration_minutes);
    setActiveContestId(c.id);
    setSetup(false);
    setEnded(true);
  }

  useEffect(() => {
    if (activeContestId) {
      api.listClaims(activeContestId).then(setClaims).catch(console.error);
    }
  }, [activeContestId]);

  async function handleClaim(problemId: string, claimedBy: string, status: string) {
    if (!activeContestId) return;
    await api.upsertClaim({ contestId: activeContestId, problemId, claimedBy, status });
    const updated = await api.listClaims(activeContestId);
    setClaims(updated);
  }

  async function rotateDriver() {
    if (!activeContestId || (!viewingHistory && active.length === 0)) return;
    const team = teamList;
    if (team.length === 0) return;
    const currentDriver = effectiveDriver || team[0];
    const idx = team.indexOf(currentDriver);
    const next = team[(idx + 1) % team.length];
    if (viewingHistory) {
      await api.setContestDriver(activeContestId!, next);
      setViewingHistory({ ...viewingHistory, driver: next });
    } else {
      setDriver(next);
      if (activeContestId) await api.setContestDriver(activeContestId, next);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const allSetupSelected = problems.length > 0 && selectedIds.length === problems.length;

  function toggleSelectAllSetup() {
    if (allSetupSelected) setSelectedIds([]);
    else setSelectedIds(problems.map((p) => p.id));
  }

  async function startContest() {
    const chosen = problems.filter((p) => selectedIds.includes(p.id));
    if (chosen.length === 0 || starting) return;
    const members = teamMembersStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setStarting(true);
    try {
      const contest = await api.createContest({
        name: contestName,
        problemIds: chosen.map((p) => p.id),
        durationMinutes,
        teamMembers: members,
        driver: driver || (members[0] || null),
      });
      setActive(chosen);
      setStatuses(
        Object.fromEntries(chosen.map((p) => [p.id, { solved: false, wrongAttempts: 0 }]))
      );
      setCurrent(chosen[0]);
      seedEditor(loadDraft(chosen[0].id, language) ?? templateFor(language, "standard"));
      setStartTime(Date.now());
      setActiveContestId(contest.id);
      setClaims([]);
      setSetup(false);
      setEnded(false);
    } catch (e) {
      console.error(e);
    } finally {
      setStarting(false);
    }
  }

  function backToSetup() {
    setViewingHistory(null);
    setSetup(true);
    setActive([]);
    setCurrent(null);
  }

  async function handleSubmit() {
    if (!current || judging || running) return;
    setJudging(true);
    setReport(null);
    setSubmitError(null);
    setLastWasSubmit(true);
    setSubmitSeq((v) => v + 1);
    const isUpsolve = ended && !viewingHistory;
    try {
      const result = await api.submitSolution({
        problemId: current.id,
        language,
        sourceCode: editorRef.current?.getValue() ?? "",
        context: { Contest: { contest_id: viewingHistory ? viewingHistory.id : "current", upsolve: isUpsolve } },
        hintsRevealed: null,
      });
      setReport(result);
      setConsoleTab("result");
      setConsoleOpen(true);
      if (result.overall_verdict === "Accepted") setBalloonTrigger((v) => v + 1);

      if (isUpsolve) return;

      setStatuses((prev) => {
        const s = { ...prev[current.id] };
        if (result.overall_verdict === "Accepted" && !s.solved) {
          s.solved = true;
          s.solvedAtSeconds = Math.floor((Date.now() - startTime) / 1000);
        } else if (result.overall_verdict !== "Accepted" && !s.solved) {
          s.wrongAttempts += 1;
        }
        return { ...prev, [current.id]: s };
      });
    } catch (e) {
      console.error(e);
      setSubmitError(String(e));
      setConsoleTab("result");
      setConsoleOpen(true);
    } finally {
      setJudging(false);
    }
  }

  async function handleRun() {
    if (!current || judging || running) return;
    setRunning(true);
    setReport(null);
    setSubmitError(null);
    try {
      const result = await api.runSolution({
        problemId: current.id,
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

  const totalPenalty = useMemo(() => {
    return Object.values(statuses).reduce((sum, s) => {
      if (!s.solved || s.solvedAtSeconds === undefined) return sum;
      const minutesElapsed = Math.floor(s.solvedAtSeconds / 60);
      return sum + minutesElapsed + s.wrongAttempts * PENALTY_MINUTES;
    }, 0);
  }, [statuses]);

  const solvedCount = Object.values(statuses).filter((s) => s.solved).length;

  if (setup) {
    return (
      <div className="h-full overflow-y-auto animate-fade-in">
        <div className="p-4 md:p-6 w-full max-w-5xl mx-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-tight">{t("contest.setup")}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{t("contest.setupSub")}</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className="tabular-nums">
                {problems.length} {t("contest.problems").toLowerCase()}
              </Badge>
              <Badge variant="outline" className="tabular-nums">
                {contests.length} {t("contest.savedCount")}
              </Badge>
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-4 mt-4">
            <Card className="p-5 lg:col-span-2 h-fit lg:sticky lg:top-0">
              <div className="text-sm font-semibold mb-4">{t("contest.configTitle")}</div>
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("contest.name")}</label>
                  <Input value={contestName} onChange={(e) => setContestName(e.target.value)} placeholder={t("contest.namePlaceholder")} />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("contest.duration")}</label>
                  <div className="flex items-center gap-2">
                    <ToolButton title="−15" onClick={() => setDurationMinutes((v) => Math.max(15, v - 15))}>
                      <span className="text-base leading-none font-semibold">−</span>
                    </ToolButton>
                    <span className="font-mono text-sm tabular-nums min-w-20 text-center">
                      {durationMinutes} min
                    </span>
                    <ToolButton title="+15" onClick={() => setDurationMinutes((v) => Math.min(600, v + 15))}>
                      <span className="text-base leading-none font-semibold">+</span>
                    </ToolButton>
                  </div>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("contest.teamMembersLabel")}</label>
                  <Input value={teamMembersStr} onChange={(e) => setTeamMembersStr(e.target.value)} placeholder={t("contest.teamPlaceholder")} />
                </div>
                {teamMembersStr.trim() && (
                  <div className="grid gap-1 animate-fade-in">
                    <label className="text-xs font-medium text-muted-foreground">{t("contest.driverLabel")}</label>
                    <Select
                      className="w-full"
                      value={driver}
                      onChange={(e) => setDriver(e.target.value)}
                    >
                      <option value="">{t("contest.autoFirstMember")}</option>
                      {teamMembersStr
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                    </Select>
                  </div>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-3 overflow-hidden flex flex-col min-h-[320px]">
              <div className="flex items-center gap-2 px-4 h-12 border-b border-border shrink-0">
                <span className="text-sm font-semibold flex-1">
                  {t("contest.problemsCount").replace("{count}", String(selectedIds.length))}
                </span>
                <Button variant="ghost" size="sm" onClick={toggleSelectAllSetup}>
                  {t(allSetupSelected ? "contest.clearSelection" : "contest.selectAll")}
                </Button>
              </div>
              <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1 max-h-[420px] lg:max-h-none">
                {problems.map((p) => (
                  <li key={p.id}>
                    <label className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-150 ${
                      selectedIds.includes(p.id)
                        ? "bg-ac/[0.06] border-ac/30"
                        : "bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.06]"
                    }`}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="h-4 w-4 rounded border-input bg-input accent-current shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{p.title}</span>
                        <span className="block text-xs text-muted-foreground truncate mt-0.5">
                          {p.source}{p.tags.length > 0 && ` · ${p.tags.slice(0, 2).join(", ")}`}
                        </span>
                      </span>
                      <DifficultyBadge difficulty={p.difficulty} />
                    </label>
                  </li>
                ))}
                {problems.length === 0 && (
                  <div className="text-xs text-muted-foreground py-8 text-center border border-dashed border-border rounded-lg m-2">
                    {t("workspace.none")}
                  </div>
                )}
              </ul>
              <div className="p-3 border-t border-border shrink-0 bg-card">
                <Button onClick={startContest} disabled={selectedIds.length === 0 || starting} variant="success" className="w-full">
                  {starting ? (
                    <>
                      <Spinner />
                      {t("contest.starting")}
                    </>
                  ) : t("contest.start")}
                </Button>
              </div>
            </Card>
          </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-semibold">{t("contest.pastContests")}</h2>
            <span className="text-xs text-muted-foreground tabular-nums">{contests.length} {t("contest.savedCount")}</span>
          </div>
          {contests.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg bg-white/[0.02]">
              {t("contest.noPastContests")}
            </div>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-2">
              {contests.map((c) => {
                const started = c.started_at ? new Date(c.started_at).toLocaleString() : "unknown";
                return (
                  <li key={c.id} className="flex items-center gap-3 p-3.5 rounded-lg border border-border bg-card hover:border-white/[0.12] hover:bg-white/[0.02] transition-all duration-150">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                        {c.problem_ids.length} {t("contest.problems").toLowerCase()} · {c.duration_minutes} min
                      </div>
                      <div className="text-[11px] text-muted-foreground/70 tabular-nums">{started}</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => reviewContest(c)} className="shrink-0">
                      {t("contest.review")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <Balloons trigger={balloonTrigger} />

      {/* Contest toolbar */}
      <div className="relative flex items-center gap-1 px-3 h-11 border-b border-border shrink-0 bg-background">
        <ToolButton title={t("contest.backToSetup")} onClick={backToSetup}>
          <Icon d={WS_ICONS.back} size={16} />
        </ToolButton>
        <span className="text-[13px] font-medium truncate max-w-40 hidden sm:inline">
          {viewingHistory ? viewingHistory.name : contestName}
        </span>
        {viewingHistory && (
          <span className="text-[11px] text-tle border border-tle/30 bg-tle/10 rounded-full px-2 py-0.5 whitespace-nowrap">
            {t("contest.viewingPast")}
          </span>
        )}
        <div className="h-5 w-px bg-border mx-1" />
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {active.map((p, i) => {
            const s = statuses[p.id];
            const isCurrent = current?.id === p.id;
            return (
              <button
                key={p.id}
                title={p.title}
                onClick={() => openContestProblem(p)}
                className={`w-7 h-7 rounded-md text-xs font-mono font-semibold flex items-center justify-center transition-all duration-150 active:scale-95 shrink-0 ${
                  isCurrent
                    ? "bg-white/[0.1] text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                } ${s?.solved ? "!text-ac" : ""}`}
              >
                {s?.solved ? <Icon d={WS_ICONS.check} size={13} /> : String.fromCharCode(65 + i)}
              </button>
            );
          })}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          <Button
            onClick={handleRun}
            disabled={judging || running || !current}
            variant="ghost"
            size="md"
            className="h-8 px-3 gap-1.5 hidden sm:inline-flex"
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
          <Timer durationMinutes={durationMinutes} onExpire={() => setEnded(true)} compact />
          {ended && <span className="text-xs text-tle font-medium hidden sm:inline">{t("contest.timesUp")}</span>}
          <Button
            onClick={handleSubmit}
            disabled={judging || running || !current}
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
                <Icon d={WS_ICONS.upload} size={14} />
                {ended && !viewingHistory ? t("contest.submitUpsolve") : t("practice.submit")}
              </>
            )}
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-xs tabular-nums hidden md:inline-flex items-center gap-1.5 rounded-full border border-border bg-white/[0.02] px-2.5 py-1">
            <span className="font-semibold text-foreground">{solvedCount}/{active.length}</span>
            <span className="text-muted-foreground">{t("contest.solved")}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{totalPenalty}min {t("contest.penalty").toLowerCase()}</span>
          </span>
          {teamList.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-full pl-2.5 pr-1 py-0.5">
              <Icon d={WS_ICONS.users} size={12} />
              <span className="max-w-24 truncate">{effectiveDriver || teamList[0]}</span>
              <button
                onClick={rotateDriver}
                title={t("contest.rotate")}
                className="w-5 h-5 flex items-center justify-center rounded-full hover:text-foreground hover:bg-white/[0.08] transition-colors"
              >
                <Icon d={WS_ICONS.rotate} size={11} />
              </button>
            </span>
          )}
          <ToolButton
            title={consoleOpen ? t("workspace.collapseConsole") : t("workspace.expandConsole")}
            onClick={() => setConsoleOpen((v) => !v)}
            disabled={!current}
          >
            <span className={`inline-block transition-transform duration-200 ${consoleOpen ? "" : "rotate-180"}`}>
              <Icon d={WS_ICONS.chevD} />
            </span>
          </ToolButton>
        </div>
      </div>
      {ended && !viewingHistory && (
        <div className="px-3 py-1.5 text-xs text-tle border-b border-tle/20 bg-tle/[0.06] shrink-0">
          {t("contest.upsolveBanner")}
        </div>
      )}

      {/* Workspace panes */}
      {current ? (
        <div className="flex-1 min-h-0 p-2">
          <SplitView
            storageKey="contest-split"
            left={
              <div className="h-full pr-1">
                <div className={`h-full rounded-lg border border-border bg-card overflow-hidden flex flex-col ${focusedPanel === "left" ? "fixed inset-2 z-[70]" : ""}`}>
                  <PanelTabs
                    active={panelTab}
                    onChange={(id) => setPanelTab(id as ContestTabId)}
                    actions={
                      <ToolButton
                        title={focusedPanel === "left" ? t("editor.unfocusPanel") : t("editor.focusPanel")}
                        onClick={() => toggleFocus("left")}
                      >
                        <Icon d={focusedPanel === "left" ? WS_ICONS.restore : WS_ICONS.expand} size={14} />
                      </ToolButton>
                    }
                    tabs={[
                      { id: "description", label: t("workspace.description"), icon: <Icon d={WS_ICONS.file} size={14} /> },
                      { id: "team", label: t("contest.team"), icon: <Icon d={WS_ICONS.users} size={14} /> },
                      { id: "standings", label: t("contest.standings"), icon: <Icon d={WS_ICONS.flag} size={14} /> },
                    ]}
                  />
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {panelTab === "description" && (
                      <div key={current.id} className="p-5 animate-panel-in">
                        <h1 className="text-lg font-semibold leading-snug">{current.title}</h1>
                        <div className="flex gap-1.5 mt-2.5 flex-wrap items-center">
                          <DifficultyBadge difficulty={current.difficulty} />
                          {current.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2.5 tabular-nums">
                          {t("practice.timeLimit")}: {current.time_limit_ms}ms · {t("practice.memory")}:{" "}
                          {current.memory_limit_mb}MB
                        </div>
                        <div className="mt-4">
                          <ProblemStatement content={current.statement_md} />
                        </div>
                        {current.tests.length > 0 && (
                          <div className="mt-6">
                            <div className="text-sm font-semibold mb-2">{t("workspace.examples")}</div>
                            <div className="space-y-2">
                              {current.tests.map((tc, i) => (
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
                      </div>
                    )}
                    {panelTab === "team" && (
                      <div className="p-4 animate-panel-in">
                        {teamList.length === 0 ? (
                          <div className="text-xs text-muted-foreground p-2">{t("contest.noTeam")}</div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-semibold">
                                {t("contest.driver")}: {effectiveDriver || teamList[0]}
                              </span>
                              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={rotateDriver}>
                                {t("contest.rotate")}
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-4">
                              {teamList.map((m) => (
                                <Badge
                                  key={m}
                                  variant="outline"
                                  className={m === effectiveDriver ? "border-ac/40 text-ac" : ""}
                                >
                                  {m}
                                </Badge>
                              ))}
                            </div>
                            <div className="space-y-1">
                              {active.map((p) => {
                                const claim = claims.find((c) => c.problem_id === p.id);
                                return (
                                  <div key={p.id} className="flex items-center gap-1.5 text-xs py-1">
                                    <span className="w-6 font-mono text-muted-foreground">
                                      {String.fromCharCode(65 + active.indexOf(p))}
                                    </span>
                                    <span className="flex-1 truncate">{p.title}</span>
                                      <Select
                                      className="text-xs max-w-24"
                                      value={claim?.claimed_by || ""}
                                      onChange={(e) => handleClaim(p.id, e.target.value, claim?.status || "thinking")}
                                    >
                                      <option value="">{t("contest.unclaimed")}</option>
                                      {teamList.map((m) => (
                                        <option key={m} value={m}>
                                          {m}
                                        </option>
                                      ))}
                                    </Select>
                                    <Select
                                      className="text-xs"
                                      value={claim?.status || "thinking"}
                                      onChange={(e) =>
                                        handleClaim(
                                          p.id,
                                          claim?.claimed_by || teamList[0] || "",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <option value="thinking">{t("contest.status.thinking")}</option>
                                      <option value="coding">{t("contest.status.coding")}</option>
                                      <option value="stuck">{t("contest.status.stuck")}</option>
                                      <option value="done">{t("contest.status.done")}</option>
                                    </Select>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {panelTab === "standings" && (
                      <div className="p-4 animate-panel-in">
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="rounded-lg border border-border bg-white/[0.02] p-3 text-center">
                            <div className="text-xl font-semibold tabular-nums leading-none">
                              {solvedCount}
                              <span className="text-muted-foreground font-normal text-sm">/{active.length}</span>
                            </div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1.5">
                              {t("contest.solved")}
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-white/[0.02] p-3 text-center">
                            <div className="text-xl font-semibold tabular-nums leading-none">
                              {totalPenalty}
                              <span className="text-muted-foreground font-normal text-sm">min</span>
                            </div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1.5">
                              {t("contest.penalty")}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {active.map((p, i) => {
                            const s = statuses[p.id];
                            return (
                              <button
                                key={p.id}
                                onClick={() => openContestProblem(p)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg border flex items-center gap-3 text-sm transition-all duration-150 ${
                                  current?.id === p.id
                                    ? "bg-white/[0.05] border-ac/30"
                                    : "bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.06]"
                                }`}
                              >
                                <span className="w-6 h-6 rounded-md bg-white/[0.05] font-mono text-xs text-muted-foreground flex items-center justify-center shrink-0">
                                  {String.fromCharCode(65 + i)}
                                </span>
                                <span className="flex-1 truncate font-medium">{p.title}</span>
                                {s?.solved ? (
                                  <span className="flex items-center gap-1.5 text-xs text-ac tabular-nums shrink-0">
                                    <Icon d={WS_ICONS.check} size={12} />
                                    {s.solvedAtSeconds !== undefined ? `${Math.floor(s.solvedAtSeconds / 60)}m` : ""}
                                    {s.wrongAttempts > 0 ? ` +${s.wrongAttempts}` : ""}
                                  </span>
                                ) : s && s.wrongAttempts > 0 ? (
                                  <Badge variant="default" className="bg-wa/15 text-wa border-wa/20 shrink-0">
                                    {s.wrongAttempts}
                                  </Badge>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground shrink-0">—</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            }
            right={
              <div className={`h-full pl-1 flex flex-col min-h-0 gap-2 ${focusedPanel === "right" ? "fixed inset-2 z-[70] bg-background p-2 pr-3 rounded-xl" : ""}`}>
                <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden">
                  <LazyCodeEditor
                    ref={editorRef}
                    language={language}
                    initialValue={editorSeed.value}
                    editorKey={editorSeed.key}
                    onLanguageChange={setLanguage}
                    onContentChange={(v) => {
                      if (current) saveDraft(current.id, language, v);
                    }}
                    onToggleFocus={() => toggleFocus("right")}
                    focused={focusedPanel === "right"}
                    draftScope={current?.id ?? "contest"}
                  />
                </div>
                {focusedPanel === "console" ? (
                  <div className="fixed inset-2 z-[70] bg-background p-2 rounded-xl flex flex-col min-h-0">
                    <ResultConsole
                      tests={current.tests}
                      timeLimitMs={current.time_limit_ms}
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
                          <FailureChips problemId={current.id} attemptKey={submitSeq} />
                        ) : null
                      }
                    />
                  </div>
                ) : (
                  <ResultConsole
                    tests={current.tests}
                    timeLimitMs={current.time_limit_ms}
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
                        <FailureChips problemId={current.id} attemptKey={submitSeq} />
                      ) : null
                    }
                  />
                )}
              </div>
            }
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          {t("contest.pickProblem")}
        </div>
      )}
    </div>
  );
}
