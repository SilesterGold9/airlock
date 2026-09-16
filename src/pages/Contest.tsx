import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { JudgeReport, Problem } from "../lib/types";
import { getVerdictInfo } from "../lib/verdict";
import CodeEditor from "../components/CodeEditor";
import VerdictBadge from "../components/VerdictBadge";
import Timer from "../components/Timer";

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

  useEffect(() => {
    api.listProblems().then(setProblems).catch(console.error);
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function startContest() {
    const chosen = problems.filter((p) => selectedIds.includes(p.id));
    if (chosen.length === 0) return;
    await api.createContest({
      name: contestName,
      problemIds: chosen.map((p) => p.id),
      durationMinutes,
    });
    setActive(chosen);
    setStatuses(
      Object.fromEntries(chosen.map((p) => [p.id, { solved: false, wrongAttempts: 0 }]))
    );
    setCurrent(chosen[0]);
    setStartTime(Date.now());
    setSetup(false);
    setEnded(false);
  }

  async function handleSubmit() {
    if (!current) return;
    setJudging(true);
    setReport(null);
    try {
      const result = await api.submitSolution({
        problemId: current.id,
        language,
        sourceCode: code,
        context: { Contest: { contest_id: "current" } },
      });
      setReport(result);

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
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-4">Set up a virtual contest</h1>
        <label className="block text-sm text-slate-400 mb-1">Contest name</label>
        <input
          className="w-full bg-slate-800 rounded px-3 py-2 mb-4"
          value={contestName}
          onChange={(e) => setContestName(e.target.value)}
        />
        <label className="block text-sm text-slate-400 mb-1">Duration (minutes)</label>
        <input
          type="number"
          className="w-full bg-slate-800 rounded px-3 py-2 mb-4"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
        />
        <label className="block text-sm text-slate-400 mb-2">
          Problems ({selectedIds.length} selected)
        </label>
        <ul className="space-y-1 mb-4 max-h-80 overflow-y-auto">
          {problems.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-900">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => toggleSelect(p.id)}
                />
                <span>{p.title}</span>
                <span className="text-xs text-slate-500 ml-auto">{p.difficulty}</span>
              </label>
            </li>
          ))}
        </ul>
        <button
          onClick={startContest}
          disabled={selectedIds.length === 0}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md px-4 py-2 font-semibold"
        >
          Start contest
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="w-64 border-r border-slate-800 p-3 flex flex-col">
        <Timer durationMinutes={durationMinutes} onExpire={() => setEnded(true)} />
        <div className="text-sm text-slate-400 mt-1 mb-4">
          Solved {solvedCount}/{active.length} · Penalty {totalPenalty}min
        </div>
        <ul className="space-y-1 overflow-y-auto">
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
                  className={`w-full text-left px-2 py-2 rounded text-sm flex justify-between ${
                    current?.id === p.id ? "bg-slate-800" : "hover:bg-slate-900"
                  }`}
                >
                  <span>
                    {String.fromCharCode(65 + i)}. {p.title}
                  </span>
                  {s?.solved ? (
                    <span className="text-ac">✓</span>
                  ) : s?.wrongAttempts ? (
                    <span className="text-wa">{s.wrongAttempts}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {ended && (
          <div className="mt-4 text-sm text-tle font-semibold">Time's up!</div>
        )}
      </aside>

      {current ? (
        <div className="flex-1 flex">
          <div className="w-1/2 overflow-y-auto p-6 border-r border-slate-800">
            <h1 className="text-xl font-bold mb-2">{current.title}</h1>
            <div className="text-sm text-slate-400 mb-4">
              Time limit: {current.time_limit_ms}ms · Memory: {current.memory_limit_mb}MB
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">
              {current.statement_md}
            </pre>
          </div>
          <div className="w-1/2 flex flex-col p-4 gap-3">
            <div className="flex-1 min-h-0">
              <CodeEditor
                language={language}
                value={code}
                onChange={setCode}
                onLanguageChange={setLanguage}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={judging || ended}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md py-2 font-semibold"
            >
              {judging ? "Judging..." : "Submit"}
            </button>
            {report && current && (
              <div className="border border-slate-800 rounded-lg p-4 max-h-[380px] overflow-y-auto bg-slate-950/30">
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
                          <div className="text-xs text-slate-400 mt-1">{info.hint}</div>
                        </div>
                      </div>
                      {isCE ? (
                        <pre className="bg-black/50 border border-slate-800 rounded p-3 text-xs whitespace-pre-wrap break-words max-h-48 overflow-auto">
                          {report.results[0]?.message || "No compiler output."}
                        </pre>
                      ) : (
                        <div className="space-y-2 mt-2">
                          <div className="text-xs text-slate-500">
                            {isAC ? `All ${report.results.length} tests passed` : `Failed at test ${report.results.length} of ${current.tests.length}`}
                          </div>
                          {report.results.map((r, i) => {
                            const test = current.tests.find((t) => t.id === r.test_id) ?? current.tests[i];
                            const isFail = r.verdict !== "Accepted";
                            return (
                              <details
                                key={r.test_id}
                                open={isFail}
                                className="bg-slate-900 rounded border border-slate-800"
                              >
                                <summary className="flex items-center justify-between px-3 py-2 cursor-pointer list-none">
                                  <span className="text-sm">Test {i + 1}</span>
                                  <span className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">{r.time_ms}ms</span>
                                    <VerdictBadge verdict={r.verdict} />
                                  </span>
                                </summary>
                                <div className="px-3 pb-3 border-t border-slate-800 pt-2">
                                  {test && (
                                    <>
                                      <div className="text-xs text-slate-300 mb-1">Input</div>
                                      <pre className="bg-black/40 rounded p-2 text-xs whitespace-pre-wrap border border-slate-800 mb-2">
                                        {test.input}
                                      </pre>
                                      <div className="text-xs text-slate-300 mb-1">Expected</div>
                                      <pre className="bg-black/40 rounded p-2 text-xs whitespace-pre-wrap border border-slate-800 mb-2">
                                        {test.expected_output}
                                      </pre>
                                    </>
                                  )}
                                  {r.actual_output != null && (
                                    <>
                                      <div className="text-xs text-slate-300 mb-1">Your output</div>
                                      <pre className={`rounded p-2 text-xs whitespace-pre-wrap border mb-2 ${isFail ? "bg-wa/10 border-wa/30" : "bg-black/40 border-slate-800"}`}>
                                        {r.actual_output || "(empty)"}
                                      </pre>
                                    </>
                                  )}
                                  {r.message && (
                                    <>
                                      <div className="text-xs text-slate-300 mb-1">Error</div>
                                      <pre className="bg-re/10 border border-re/30 rounded p-2 text-xs whitespace-pre-wrap">
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
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Pick a problem from the sidebar
        </div>
      )}
    </div>
  );
}
