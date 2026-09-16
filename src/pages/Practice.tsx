import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { JudgeReport, Problem } from "../lib/types";
import { getVerdictInfo } from "../lib/verdict";
import CodeEditor from "../components/CodeEditor";
import VerdictBadge from "../components/VerdictBadge";

export default function Practice() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selected, setSelected] = useState<Problem | null>(null);
  const [language, setLanguage] = useState<"cpp" | "java">("cpp");
  const [code, setCode] = useState("");
  const [report, setReport] = useState<JudgeReport | null>(null);
  const [judging, setJudging] = useState(false);
  const [tagFilter, setTagFilter] = useState<string>("all");

  useEffect(() => {
    api.listProblems().then(setProblems).catch(console.error);
  }, []);

  const allTags = Array.from(new Set(problems.flatMap((p) => p.tags))).sort();
  const visible =
    tagFilter === "all" ? problems : problems.filter((p) => p.tags.includes(tagFilter));

  async function handleSubmit() {
    if (!selected) return;
    setJudging(true);
    setReport(null);
    try {
      const result = await api.submitSolution({
        problemId: selected.id,
        language,
        sourceCode: code,
        context: "Practice",
      });
      setReport(result);
    } catch (e) {
      console.error(e);
    } finally {
      setJudging(false);
    }
  }

  return (
    <div className="flex h-full">
      {/* Problem list */}
      <aside className="w-72 border-r border-slate-800 overflow-y-auto p-3">
        <select
          className="w-full mb-3 bg-slate-800 text-sm rounded px-2 py-1"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="all">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <ul className="space-y-1">
          {visible.map((p) => (
            <li key={p.id}>
              <button
                className={`w-full text-left px-2 py-2 rounded text-sm ${
                  selected?.id === p.id ? "bg-slate-800" : "hover:bg-slate-900"
                }`}
                onClick={() => {
                  setSelected(p);
                  setReport(null);
                  setCode("");
                }}
              >
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-slate-500">
                  {p.source} · {p.difficulty}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Statement + editor */}
      {selected ? (
        <div className="flex-1 flex">
          <div className="w-1/2 overflow-y-auto p-6 border-r border-slate-800">
            <h1 className="text-xl font-bold mb-2">{selected.title}</h1>
            <div className="flex gap-2 mb-4">
              {selected.tags.map((t) => (
                <span key={t} className="text-xs bg-slate-800 px-2 py-0.5 rounded">
                  {t}
                </span>
              ))}
            </div>
            <div className="text-sm text-slate-400 mb-4">
              Time limit: {selected.time_limit_ms}ms · Memory: {selected.memory_limit_mb}MB
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">
              {selected.statement_md}
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
              disabled={judging}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md py-2 font-semibold"
            >
              {judging ? "Judging..." : "Submit"}
            </button>

            {report && selected && (
              <div className="border border-slate-800 rounded-lg p-4 max-h-[420px] overflow-y-auto bg-slate-950/30">
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
                          <div className="text-xs text-slate-400 mt-1 leading-relaxed">{info.hint}</div>
                        </div>
                      </div>

                      {isCE ? (
                        <div className="mt-3">
                          <div className="text-xs font-semibold text-slate-300 mb-1">Compiler says:</div>
                          <pre className="bg-black/50 border border-slate-800 rounded p-3 text-xs whitespace-pre-wrap break-words max-h-64 overflow-auto">
                            {report.results[0]?.message || "No details. You can try compiling locally with g++ -O2 -std=c++17."}
                          </pre>
                          <div className="text-xs text-slate-500 mt-2">
                            For C++ make sure you include bits and use correct syntax. For Java the file must contain <span className="text-slate-300">public class Main</span>.
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 mt-3">
                          <div className="text-xs font-semibold text-slate-300">
                            {isAC ? `All ${report.results.length} tests passed` : `Stopped at test ${report.results.length} of ${selected.tests.length}`}
                            <span className="font-normal text-slate-500 ml-2">
                              limit {selected.time_limit_ms}ms
                            </span>
                          </div>
                          {report.results.map((r, i) => {
                            const infoR = getVerdictInfo(r.verdict);
                            const test = selected.tests.find((t) => t.id === r.test_id) ?? selected.tests[i];
                            const isFail = r.verdict !== "Accepted";
                            return (
                              <details
                                key={r.test_id}
                                open={isFail}
                                className="bg-slate-900 rounded border border-slate-800 open:border-slate-700"
                              >
                                <summary className="flex items-center justify-between px-3 py-2 cursor-pointer list-none">
                                  <span className="text-sm font-medium">Test {i + 1}</span>
                                  <span className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 tabular-nums">{r.time_ms}ms</span>
                                    <VerdictBadge verdict={r.verdict} />
                                  </span>
                                </summary>
                                <div className="px-3 pb-3 pt-1 border-t border-slate-800">
                                  <div className="text-xs text-slate-400 mb-1">{infoR.long}: {infoR.description}</div>
                                  {test && (
                                    <div className="grid gap-3 mt-2">
                                      <div>
                                        <div className="text-xs font-semibold text-slate-300 mb-1">Input</div>
                                        <pre className="bg-black/40 rounded p-2 text-xs whitespace-pre-wrap break-words border border-slate-800">
                                          {test.input || "(empty)"}
                                        </pre>
                                      </div>
                                      <div>
                                        <div className="text-xs font-semibold text-slate-300 mb-1">Expected output</div>
                                        <pre className="bg-black/40 rounded p-2 text-xs whitespace-pre-wrap break-words border border-slate-800">
                                          {test.expected_output || "(empty)"}
                                        </pre>
                                      </div>
                                      {r.actual_output != null && (
                                        <div>
                                          <div className="text-xs font-semibold text-slate-300 mb-1">Your output</div>
                                          <pre className={`rounded p-2 text-xs whitespace-pre-wrap break-words border ${isFail ? "bg-wa/10 border-wa/30" : "bg-black/40 border-slate-800"}`}>
                                            {r.actual_output || "(no output)"}
                                          </pre>
                                        </div>
                                      )}
                                      {r.message && (
                                        <div>
                                          <div className="text-xs font-semibold text-slate-300 mb-1">Runtime output</div>
                                          <pre className="bg-re/10 border border-re/30 rounded p-2 text-xs whitespace-pre-wrap break-words">
                                            {r.message}
                                          </pre>
                                        </div>
                                      )}
                                      {r.verdict === "WrongAnswer" && r.actual_output != null && test && (
                                        <div className="text-xs text-slate-500">
                                          Hint: output comparison ignores trailing spaces per line, but not missing lines. Check newlines.
                                        </div>
                                      )}
                                      {r.verdict === "TimeLimitExceeded" && (
                                        <div className="text-xs text-tle">
                                          Your program did not finish in {selected.time_limit_ms}ms. Look for infinite loops or O(n²) on large input.
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </details>
                            );
                          })}
                          {isAC && (
                            <div className="text-xs text-ac mt-2">Submitted and logged. Keep going.</div>
                          )}
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
          Select a problem to start
        </div>
      )}
    </div>
  );
}
