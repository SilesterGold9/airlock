import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { loadDraft, saveDraft } from "../lib/drafts";
import { templateFor } from "../lib/templates";
import type { Contest as ContestModel, JudgeReport, Problem } from "../lib/types";
import { getVerdictInfo } from "../lib/verdict";
import LazyCodeEditor, { type CodeEditorHandle } from "../components/LazyCodeEditor";
import { usePersistentState } from "../lib/persist";
import VerdictBadge from "../components/VerdictBadge";
import Timer from "../components/Timer";
import { Badge, DifficultyBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { SplitView } from "../components/ui/split-view";
import { PanelTabs, ToolButton, Icon, WS_ICONS } from "../components/PanelTabs";
import DiffViewer from "../components/DiffViewer";
import FailureChips from "../components/FailureChips";
import ProblemStatement from "../components/ProblemStatement";
import { Input } from "../components/ui/input";
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
  const [running, setRunning] = useState(false);
  const [lastWasSubmit, setLastWasSubmit] = useState(true);
  const [panelTab, setPanelTab] = useState<ContestTabId>("description");
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleTab, setConsoleTab] = useState<"testcase" | "result">("testcase");
  const [expandedCase, setExpandedCase] = useState<number | null>(null);

  useEffect(() => {
    api.listProblems().then(setProblems).catch(console.error);
  }, []);

  useEffect(() => {
    if (setup) {
      api.listContests().then(setContests).catch(console.error);
    }
  }, [setup]);

  useEffect(() => {
    setExpandedCase(null);
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

  async function startContest() {
    const chosen = problems.filter((p) => selectedIds.includes(p.id));
    if (chosen.length === 0) return;
    const members = teamMembersStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
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
    } finally {
      setJudging(false);
    }
  }

  async function handleRun() {
    if (!current || judging || running) return;
    setRunning(true);
    setReport(null);
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
  const failCount =
    report && report.overall_verdict !== "Accepted"
      ? report.tests_total - report.tests_passed
      : 0;

  if (setup) {
    return (
      <div className="p-6 max-w-2xl mx-auto animate-fade-in">
        <h1 className="text-xl font-semibold mb-6">{t("contest.setup")}</h1>
        <Card className="p-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t("contest.name")}</label>
          <Input className="mb-4" value={contestName} onChange={(e) => setContestName(e.target.value)} placeholder={t("contest.namePlaceholder")} />
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t("contest.duration")}</label>
          <Input type="number" className="mb-4" value={String(durationMinutes)} onChange={(e) => setDurationMinutes(Math.max(1, Math.round(Number(e.target.value) || 180)))} />
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t("contest.teamMembersLabel")}</label>
          <Input className="mb-2" value={teamMembersStr} onChange={(e) => setTeamMembersStr(e.target.value)} placeholder={t("contest.teamPlaceholder")} />
          {teamMembersStr.trim() && (
            <>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("contest.driverLabel")}</label>
              <select
                className="w-full mb-4 bg-input border border-input rounded-lg h-9 px-3 text-sm text-foreground"
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
              </select>
            </>
          )}
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            {t("contest.problemsCount").replace("{count}", String(selectedIds.length))}
          </label>
          <ul className="space-y-0 mb-6 max-h-80 overflow-y-auto border border-border rounded-lg">
            {problems.map((p) => (
              <li key={p.id} className="border-b border-white/[0.04] last:border-0">
                <label className="flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.04] cursor-pointer transition-colors duration-150">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="h-4 w-4 rounded border-input bg-input accent-current"
                  />
                  <span className="text-sm font-medium flex-1">{p.title}</span>
                  <DifficultyBadge difficulty={p.difficulty} />
                </label>
              </li>
            ))}
          </ul>
          <Button onClick={startContest} disabled={selectedIds.length === 0} variant="success" className="w-full">
            {t("contest.start")}
          </Button>
        </Card>

        <Card className="p-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">{t("contest.pastContests")}</h2>
            <span className="text-xs text-muted-foreground">{contests.length} {t("contest.savedCount")}</span>
          </div>
          {contests.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg bg-white/[0.02]">
              {t("contest.noPastContests")}
            </div>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {contests.map((c) => {
                const started = c.started_at ? new Date(c.started_at).toLocaleString() : "unknown";
                return (
                  <li key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-white/[0.04] transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.problem_ids.length} {t("contest.problems").toLowerCase()} · {c.duration_minutes} min · {started}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => reviewContest(c)}>
                      {t("contest.review")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.2-8.56" />
                </svg>
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
          <span className="text-xs text-muted-foreground tabular-nums hidden md:inline">
            {t("contest.solved")} {solvedCount}/{active.length} · {t("contest.penalty")} {totalPenalty}min
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
                <div className="h-full rounded-lg border border-border bg-card overflow-hidden flex flex-col">
                  <PanelTabs
                    active={panelTab}
                    onChange={(id) => setPanelTab(id as ContestTabId)}
                    tabs={[
                      { id: "description", label: t("workspace.description"), icon: <Icon d={WS_ICONS.file} size={14} /> },
                      { id: "team", label: t("contest.team"), icon: <Icon d={WS_ICONS.users} size={14} /> },
                      { id: "standings", label: t("contest.standings"), icon: <Icon d={WS_ICONS.flag} size={14} /> },
                    ]}
                  />
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {panelTab === "description" && (
                      <div key={current.id} className="p-5 animate-panel-in">
                        <h1 className="text-[15px] font-semibold leading-tight">{current.title}</h1>
                        <div className="flex gap-1.5 mt-3 flex-wrap items-center">
                          <DifficultyBadge difficulty={current.difficulty} />
                          {current.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-3 tabular-nums">
                          {t("practice.timeLimit")}: {current.time_limit_ms}ms · {t("practice.memory")}:{" "}
                          {current.memory_limit_mb}MB
                        </div>
                        <div className="mt-4">
                          <ProblemStatement content={current.statement_md} />
                        </div>
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
                                    <select
                                      className="bg-input border border-input rounded-md text-xs h-7 px-1.5 max-w-24"
                                      value={claim?.claimed_by || ""}
                                      onChange={(e) => handleClaim(p.id, e.target.value, claim?.status || "thinking")}
                                    >
                                      <option value="">{t("contest.unclaimed")}</option>
                                      {teamList.map((m) => (
                                        <option key={m} value={m}>
                                          {m}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      className="bg-input border border-input rounded-md text-xs h-7 px-1.5"
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
                                    </select>
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
                        <div className="space-y-0.5">
                          {active.map((p, i) => {
                            const s = statuses[p.id];
                            return (
                              <button
                                key={p.id}
                                onClick={() => openContestProblem(p)}
                                className={`w-full text-left px-2 py-2 rounded-lg hover:bg-white/[0.04] flex items-center gap-2 text-sm transition-colors duration-150 ${
                                  current?.id === p.id ? "bg-white/[0.05]" : ""
                                }`}
                              >
                                <span className="w-6 font-mono text-xs text-muted-foreground">
                                  {String.fromCharCode(65 + i)}
                                </span>
                                <span className="flex-1 truncate">{p.title}</span>
                                {s?.solved ? (
                                  <span className="flex items-center gap-1 text-xs text-ac tabular-nums">
                                    <Icon d={WS_ICONS.check} size={12} />
                                    {s.solvedAtSeconds !== undefined ? `${Math.floor(s.solvedAtSeconds / 60)}m` : ""}
                                    {s.wrongAttempts > 0 ? ` +${s.wrongAttempts}` : ""}
                                  </span>
                                ) : s && s.wrongAttempts > 0 ? (
                                  <Badge variant="default" className="bg-wa/15 text-wa border-wa/20">
                                    {s.wrongAttempts}
                                  </Badge>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">—</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06] text-xs text-muted-foreground tabular-nums">
                          <span>
                            {t("contest.solved")} {solvedCount}/{active.length}
                          </span>
                          <span>
                            {t("contest.penalty")} {totalPenalty}min
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            }
            right={
              <div className="h-full pl-1 flex flex-col min-h-0 gap-2">
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
                    draftScope={current?.id ?? "contest"}
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
                            <Icon d={failCount > 0 ? WS_ICONS.x : WS_ICONS.check} size={13} />
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
                          <Icon d={WS_ICONS.chevD} />
                        </span>
                      </ToolButton>
                    </div>
                  </div>
                  {consoleOpen && (
                    <div className="h-[calc(100%-2.75rem)] overflow-y-auto p-3 animate-fade-in">
                      {consoleTab === "testcase" && (
                        <div className="space-y-1">
                          {current.tests.length === 0 && (
                            <div className="text-xs text-muted-foreground">{t("workspace.none")}</div>
                          )}
                          {current.tests.map((tc, i) => (
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
                                      <FailureChips problemId={current.id} attemptKey={submitSeq} />
                                    )}
                                    {isCE ? (
                                      <pre className="mt-3 bg-black/40 border border-border rounded-lg p-3 text-xs whitespace-pre-wrap break-words max-h-48 overflow-auto font-mono">
                                        {report.results[0]?.message || t("contest.noCompilerOutput")}
                                      </pre>
                                    ) : (
                                      <div className="space-y-2 mt-3">
                                        <div className="text-xs text-muted-foreground">
                                          {report.tests_passed}/{report.tests_total} {t("practice.testsPassed")}
                                          {!isAC && (
                                            <span className="ml-2 text-wa">
                                              {report.tests_total - report.tests_passed} {t("practice.failedCount")}
                                            </span>
                                          )}
                                          <span className="ml-2">
                                            {t("practice.limit")} {current.time_limit_ms}ms
                                          </span>
                                        </div>
                                        {report.results.map((r, i) => {
                                          const test =
                                            current.tests.find((tt) => tt.id === r.test_id) ??
                                            current.tests[i];
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
                                                {test && (
                                                  <>
                                                    <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">
                                                      {t("common.input")}
                                                    </div>
                                                    <pre className="bg-white/[0.02] rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-white/[0.04] font-mono">
                                                      {test.input}
                                                    </pre>
                                                    {r.verdict === "WrongAnswer" && r.actual_output != null ? (
                                                      <DiffViewer
                                                        expected={test.expected_output || ""}
                                                        actual={r.actual_output || ""}
                                                      />
                                                    ) : (
                                                      <>
                                                        <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground/70 mb-1 mt-2">
                                                          {t("common.expected")}
                                                        </div>
                                                        <pre className="bg-white/[0.02] rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-white/[0.04] font-mono">
                                                          {test.expected_output}
                                                        </pre>
                                                        {r.actual_output != null && (
                                                          <>
                                                            <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground/70 mb-1 mt-2">
                                                              {t("common.yourOutput")}
                                                            </div>
                                                            <pre
                                                              className={`rounded-md p-2 text-xs whitespace-pre-wrap break-words border font-mono ${
                                                                isFail
                                                                  ? "bg-wa/[0.04] border-wa/20"
                                                                  : "bg-white/[0.02] border-white/[0.04]"
                                                              }`}
                                                            >
                                                              {r.actual_output}
                                                            </pre>
                                                          </>
                                                        )}
                                                      </>
                                                    )}
                                                  </>
                                                )}
                                              </div>
                                            </details>
                                          );
                                        })}
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
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          {t("contest.pickProblem")}
        </div>
      )}
    </div>
  );
}
