import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Contest as ContestModel, JudgeReport, Problem } from "../lib/types";
import { getVerdictInfo } from "../lib/verdict";
import CodeEditor from "../components/CodeEditor";
import VerdictBadge from "../components/VerdictBadge";
import Timer from "../components/Timer";
import { Badge, DifficultyBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { SplitView } from "../components/ui/split-view";
import DiffViewer from "../components/DiffViewer";
import { Input } from "../components/ui/input";
import Balloons from "../components/Balloons";

interface ProblemStatus {
  solved: boolean;
  wrongAttempts: number;
  solvedAtSeconds?: number;
}

const PENALTY_MINUTES = 20;

export default function Contest() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [setup, setSetup] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [contestName, setContestName] = useState("Virtual Contest");

  const [active, setActive] = useState<Problem[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ProblemStatus>>({});
  const [current, setCurrent] = useState<Problem | null>(null);
  const [language, setLanguage] = useState<"cpp" | "java">("cpp");
  const [code, setCode] = useState("");
  const [report, setReport] = useState<JudgeReport | null>(null);
  const [judging, setJudging] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [ended, setEnded] = useState(false);
  const [contests, setContests] = useState<ContestModel[]>([]);
  const [viewingHistory, setViewingHistory] = useState<ContestModel | null>(null);
  const [teamMembersStr, setTeamMembersStr] = useState("");
  const [driver, setDriver] = useState("");
  const [claims, setClaims] = useState<import("../lib/types").ProblemClaim[]>([]);
  const [activeContestId, setActiveContestId] = useState<string | null>(null);
  const [balloonTrigger, setBalloonTrigger] = useState(0);

  useEffect(() => {
    api.listProblems().then(setProblems).catch(console.error);
  }, []);

  useEffect(() => {
    if (setup) {
      api.listContests().then(setContests).catch(console.error);
    }
  }, [setup]);

  function reviewContest(c: ContestModel) {
    const chosen = problems.filter((p) => c.problem_ids.includes(p.id));
    if (chosen.length === 0) return;
    setActive(chosen);
    setStatuses(Object.fromEntries(chosen.map((p) => [p.id, { solved: false, wrongAttempts: 0 }])));
    setCurrent(chosen[0]);
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
    if (!activeContestId || !viewingHistory && active.length === 0) return;
    const members = viewingHistory ? viewingHistory.team_members : active.length ? [] : [];
    // fallback to current active contest members from last created contest
    // if no viewingHistory, use teamMembersStr split
    const team = viewingHistory?.team_members?.length ? viewingHistory.team_members : teamMembersStr.split(",").map((s) => s.trim()).filter(Boolean);
    if (team.length === 0) return;
    const currentDriver = viewingHistory?.driver || driver || team[0];
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
    setStartTime(Date.now());
    setActiveContestId(contest.id);
    setClaims([]);
    setSetup(false);
    setEnded(false);
  }

  async function handleSubmit() {
    if (!current) return;
    setJudging(true);
    setReport(null);
    const isUpsolve = ended && !viewingHistory;
    try {
      const result = await api.submitSolution({
        problemId: current.id,
        language,
        sourceCode: code,
        context: { Contest: { contest_id: viewingHistory ? viewingHistory.id : "current", upsolve: isUpsolve } },
      });
      setReport(result);
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
      <div className="p-6 max-w-2xl mx-auto animate-fade-in">
        <h1 className="text-xl font-semibold mb-6">Set up a virtual contest</h1>
        <Card className="p-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Contest name</label>
          <Input className="mb-4" value={contestName} onChange={(e) => setContestName(e.target.value)} placeholder="My contest" />
          <label className="block text-xs font-medium text-muted-foreground mb-1">Duration (minutes)</label>
          <Input type="number" className="mb-4" value={String(durationMinutes)} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
          <label className="block text-xs font-medium text-muted-foreground mb-1">Team members comma separated, 3 for ICPC</label>
          <Input className="mb-2" value={teamMembersStr} onChange={(e) => setTeamMembersStr(e.target.value)} placeholder="Alice, Bob, Carol" />
          {teamMembersStr.trim() && (
            <>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Driver to start</label>
              <select
                className="w-full mb-4 bg-input border border-input rounded-lg h-9 px-3 text-sm text-foreground"
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
              >
                <option value="">Auto first member</option>
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
            Problems ({selectedIds.length} selected)
          </label>
          <ul className="space-y-0 mb-6 max-h-80 overflow-y-auto border border-border rounded-lg">
            {problems.map((p) => (
              <li key={p.id} className="border-b border-white/[0.04] last:border-0">
                <label className="flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.04] cursor-pointer transition-colors duration-150">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="h-4 w-4 rounded border-input bg-input text-brand focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
                  />
                  <span className="text-sm font-medium flex-1">{p.title}</span>
                  <DifficultyBadge difficulty={p.difficulty} />
                </label>
              </li>
            ))}
          </ul>
          <Button onClick={startContest} disabled={selectedIds.length === 0} variant="primary" className="w-full">
            Start contest
          </Button>
        </Card>

        <Card className="p-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Past contests</h2>
            <span className="text-xs text-muted-foreground">{contests.length} saved</span>
          </div>
          {contests.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg bg-white/[0.02]">
              No past contests yet. Run one and it will appear here.
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
                        {c.problem_ids.length} problems · {c.duration_minutes} min · {started}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => reviewContest(c)}>
                      Review
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
    <div className="flex h-full bg-background">
      <Balloons trigger={balloonTrigger} />
      <aside className="w-64 border-r border-border p-3 flex flex-col shrink-0 bg-background">
        {viewingHistory && (
          <div className="mb-3 p-2 rounded-lg bg-wa/10 border border-wa/20">
            <div className="text-xs font-semibold text-wa">Viewing past contest</div>
            <div className="text-xs text-muted-foreground truncate">{viewingHistory.name}</div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => {
                setViewingHistory(null);
                setSetup(true);
                setActive([]);
                setCurrent(null);
              }}
            >
              Back to setup
            </Button>
          </div>
        )}
        <Timer durationMinutes={durationMinutes} onExpire={() => setEnded(true)} />
        <div className="text-xs text-muted-foreground mt-1 mb-2 tabular-nums">
          Solved {solvedCount}/{active.length} · Penalty {totalPenalty}min
        </div>
        {(viewingHistory?.team_members?.length || teamMembersStr.trim()) && (
          <Card className="p-2 mb-3 bg-card/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Team {viewingHistory?.driver || driver ? `· driver ${viewingHistory?.driver || driver}` : ""}</span>
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={rotateDriver}>
                Rotate
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {(viewingHistory?.team_members || teamMembersStr.split(",").map((s) => s.trim()).filter(Boolean)).join(" · ") || "No team"}
            </div>
            <div className="mt-2 space-y-1">
              {active.map((p) => {
                const claim = claims.find((c) => c.problem_id === p.id);
                return (
                  <div key={p.id} className="flex items-center gap-1 text-xs">
                    <span className="w-6 font-mono">{String.fromCharCode(65 + active.indexOf(p))}</span>
                    <span className="flex-1 truncate">{p.title.slice(0, 18)}</span>
                    <select
                      className="bg-input border border-input rounded text-xs h-6 px-1"
                      value={claim?.claimed_by || ""}
                      onChange={(e) => handleClaim(p.id, e.target.value, claim?.status || "thinking")}
                    >
                      <option value="">unclaimed</option>
                      {(viewingHistory?.team_members || teamMembersStr.split(",").map((s) => s.trim()).filter(Boolean)).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      className="bg-input border border-input rounded text-xs h-6 px-1"
                      value={claim?.status || "thinking"}
                      onChange={(e) => handleClaim(p.id, claim?.claimed_by || (viewingHistory?.team_members?.[0] || teamMembersStr.split(",")[0]?.trim() || ""), e.target.value)}
                    >
                      <option value="thinking">thinking</option>
                      <option value="coding">coding</option>
                      <option value="stuck">stuck</option>
                      <option value="done">done</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        <ul className="space-y-0 overflow-y-auto">
          {active.map((p, i) => {
            const s = statuses[p.id];
            return (
              <li key={p.id}>
                <button
                  onClick={() => {
                    setCurrent(p);
                    setReport(null);
                    setCode("");
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex justify-between items-center border-b border-white/[0.04] last:border-0 transition-colors duration-150 ${
                    current?.id === p.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="font-medium">
                    {String.fromCharCode(65 + i)}. {p.title}
                  </span>
                  {s?.solved ? (
                    <span className="text-ac">✓</span>
                  ) : s?.wrongAttempts ? (
                    <Badge variant="default" className="bg-wa/15 text-wa border-wa/20">
                      {s.wrongAttempts}
                    </Badge>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {ended && <div className="mt-4 text-sm text-tle font-semibold">Time's up!</div>}
      </aside>

      {current ? (
        <div className="flex-1 min-w-0">
          <SplitView
            storageKey="contest-split"
            left={
              <div className="overflow-y-auto p-6 h-full animate-fade-in">
                <h1 className="text-[15px] font-semibold mb-3">{current.title}</h1>
                <div className="text-xs text-muted-foreground mb-4 tabular-nums">
                  Time limit: {current.time_limit_ms}ms · Memory: {current.memory_limit_mb}MB
                </div>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90">
                  {current.statement_md}
                </pre>
              </div>
            }
            right={
              <div className="flex flex-col p-4 gap-3 h-full bg-background">
                <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border bg-card">
                  <CodeEditor
                    language={language}
                    value={code}
                    onChange={setCode}
                    onLanguageChange={setLanguage}
                  />
                </div>
                <Button onClick={handleSubmit} disabled={judging} variant="primary" className="w-full">
                  {judging ? "Judging..." : ended && !viewingHistory ? "Submit (upsolve)" : "Submit"}
                </Button>
                {ended && !viewingHistory && (
                  <div className="text-xs text-tle border border-tle/30 bg-tle/10 rounded-md px-3 py-2">
                    Time is up. You are now upsolving. Submissions are tagged as upsolve and do not affect the live scoreboard.
                  </div>
                )}
                {report && (
                  <div className="border border-border rounded-lg p-4 max-h-[380px] overflow-y-auto bg-card animate-slide-up">
                    {(() => {
                      const info = getVerdictInfo(report.overall_verdict);
                      const isCE = report.overall_verdict === "CompileError";
                      const isAC = report.overall_verdict === "Accepted";
                      return (
                        <>
                          <div className="flex items-start gap-3 mb-3">
                            <VerdictBadge verdict={report.overall_verdict} size="lg" showLong />
                            <div className="flex-1">
                              <div className="font-semibold text-sm">{info.description}</div>
                              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{info.hint}</div>
                            </div>
                          </div>
                          {isCE ? (
                            <pre className="bg-black/40 border border-border rounded-lg p-3 text-xs whitespace-pre-wrap break-words max-h-48 overflow-auto font-mono">
                              {report.results[0]?.message || "No compiler output."}
                            </pre>
                          ) : (
                            <div className="space-y-2 mt-2">
                              <div className="text-xs text-muted-foreground">
                                {report.tests_passed}/{report.tests_total} tests passed
                                {!isAC && <span className="ml-2 text-wa">{report.tests_total - report.tests_passed} failed</span>}
                                <span className="ml-2">limit {current.time_limit_ms}ms</span>
                              </div>
                              {report.results.map((r, i) => {
                                const test = current.tests.find((t) => t.id === r.test_id) ?? current.tests[i];
                                const isFail = r.verdict !== "Accepted";
                                return (
                                  <details
                                    key={r.test_id}
                                    open={isFail}
                                    className="bg-background rounded-lg border border-border"
                                  >
                                    <summary className="flex items-center justify-between px-3 py-2 cursor-pointer list-none">
                                      <span className="text-sm font-medium">Test {i + 1}</span>
                                      <span className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground tabular-nums">{r.time_ms}ms</span>
                                        <VerdictBadge verdict={r.verdict} />
                                      </span>
                                    </summary>
                                    <div className="px-3 pb-3 border-t border-border pt-2">
                                      {test && (
                                        <>
                                          <div className="text-xs font-semibold text-foreground mb-1">Input</div>
                                          <pre className="bg-black/40 rounded-md p-2 text-xs whitespace-pre-wrap border border-border mb-2 font-mono">
                                            {test.input}
                                          </pre>
                                          {r.verdict === "WrongAnswer" && r.actual_output != null ? (
                                            <DiffViewer expected={test.expected_output || ""} actual={r.actual_output || ""} />
                                          ) : (
                                            <>
                                              <div className="text-xs font-semibold text-foreground mb-1">Expected</div>
                                              <pre className="bg-black/40 rounded-md p-2 text-xs whitespace-pre-wrap border border-border mb-2 font-mono">
                                                {test.expected_output}
                                              </pre>
                                              {r.actual_output != null && (
                                                <>
                                                  <div className="text-xs font-semibold text-foreground mb-1">Your output</div>
                                                  <pre
                                                    className={`rounded-md p-2 text-xs whitespace-pre-wrap border mb-2 font-mono ${
                                                      isFail ? "bg-wa/10 border-wa/30" : "bg-black/40 border-border"
                                                    }`}
                                                  >
                                                    {r.actual_output || "(empty)"}
                                                  </pre>
                                                </>
                                              )}
                                            </>
                                          )}
                                        </>
                                      )}
                                      {r.actual_output != null && !test && (
                                        <>
                                          <div className="text-xs font-semibold text-foreground mb-1">Your output</div>
                                          <pre
                                            className={`rounded-md p-2 text-xs whitespace-pre-wrap border mb-2 font-mono ${
                                              isFail ? "bg-wa/10 border-wa/30" : "bg-black/40 border-border"
                                            }`}
                                          >
                                            {r.actual_output || "(empty)"}
                                          </pre>
                                        </>
                                      )}
                                      {r.message && (
                                        <>
                                          <div className="text-xs font-semibold text-foreground mb-1">Error</div>
                                          <pre className="bg-re/10 border border-re/30 rounded-md p-2 text-xs whitespace-pre-wrap font-mono">
                                            {r.message}
                                          </pre>
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
              </div>
            }
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Pick a problem from the sidebar</div>
      )}
    </div>
  );
}
