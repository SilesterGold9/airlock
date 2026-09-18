import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { JudgeReport, Problem } from "../lib/types";
import { getVerdictInfo } from "../lib/verdict";
import CodeEditor from "../components/CodeEditor";
import VerdictBadge from "../components/VerdictBadge";
import { Badge, DifficultyBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { SplitView } from "../components/ui/split-view";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import DiffViewer from "../components/DiffViewer";

export default function Practice() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selected, setSelected] = useState<Problem | null>(null);
  const [language, setLanguage] = useState<"cpp" | "java">("cpp");
  const [code, setCode] = useState("");
  const [report, setReport] = useState<JudgeReport | null>(null);
  const [judging, setJudging] = useState(false);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    api.listProblems().then(setProblems).catch(console.error);
  }, []);

  useEffect(() => {
    setNotes(selected?.notes_md || "");
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    if (notes === (selected.notes_md || "")) return;
    setNotesSaving(true);
    const t = setTimeout(async () => {
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
    return () => clearTimeout(t);
  }, [notes]);

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
    <div className="flex h-full bg-background">
      {/* Problem list */}
      <aside className="w-72 border-r border-border overflow-y-auto p-3 shrink-0 bg-background">
        <Select
          className="w-full mb-3"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="all">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <ul className="space-y-0">
          {visible.map((p) => (
            <li key={p.id}>
              <button
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex flex-col gap-1 border-b border-white/[0.04] last:border-0 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] ${
                  selected?.id === p.id ? "bg-white/[0.08] text-foreground" : "hover:bg-white/[0.04] text-foreground"
                }`}
                onClick={() => {
                  setSelected(p);
                  setReport(null);
                  setCode("");
                }}
              >
                <div className="font-medium leading-tight">{p.title}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{p.source}</span>
                  <DifficultyBadge difficulty={p.difficulty} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Statement + editor */}
      {selected ? (
        <div className="flex-1 min-w-0">
          <SplitView
            storageKey="practice-split"
            left={
              <div className="overflow-y-auto p-6 h-full animate-fade-in">
                <h1 className="text-[15px] font-semibold mb-3 leading-tight">{selected.title}</h1>
                <div className="flex gap-1.5 mb-4 flex-wrap">
                  {selected.tags.map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                  <DifficultyBadge difficulty={selected.difficulty} />
                </div>
                <div className="text-xs text-muted-foreground mb-4 tabular-nums">
                  Time limit: {selected.time_limit_ms}ms · Memory: {selected.memory_limit_mb}MB
                </div>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90">
                  {selected.statement_md}
                </pre>

                <Card className="mt-6">
                  <button
                    onClick={() => setNotesOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-sm font-semibold">My notes</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      {notesSaving ? "Saving…" : notes ? "Saved" : "No notes"}
                      <span className={`transition-transform ${notesOpen ? "rotate-180" : ""}`}>▾</span>
                    </span>
                  </button>
                  {notesOpen && (
                    <div className="px-4 pb-4">
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Write your approach after solving. It sticks for your juniors and for you."
                        className="min-h-[140px] font-sans text-sm"
                      />
                      <div className="text-xs text-muted-foreground mt-2">
                        Autosaved to the problem. Visible next time you open it.
                      </div>
                    </div>
                  )}
                </Card>
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
                <Button onClick={handleSubmit} disabled={judging} variant="primary" size="md" className="w-full">
                  {judging ? "Judging..." : "Submit"}
                </Button>

                {report && (
                  <div className="border border-border rounded-lg p-4 max-h-[420px] overflow-y-auto bg-card animate-slide-up">
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
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-foreground mb-1">Compiler says:</div>
                              <pre className="bg-black/40 border border-border rounded-lg p-3 text-xs whitespace-pre-wrap break-words max-h-64 overflow-auto font-mono">
                                {report.results[0]?.message || "No details. You can try compiling locally with g++ -O2 -std=c++17."}
                              </pre>
                              <div className="text-xs text-muted-foreground mt-2">
                                For C++ make sure you include bits and use correct syntax. For Java the file must contain{" "}
                                <span className="text-foreground font-mono">public class Main</span>.
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2 mt-3">
                              <div className="text-xs font-semibold text-foreground">
                                {report.tests_passed}/{report.tests_total} tests passed
                                <span className="font-normal text-muted-foreground ml-2">limit {selected.time_limit_ms}ms</span>
                                {!isAC && <span className="ml-2 text-wa">• {report.tests_total - report.tests_passed} failed</span>}
                              </div>
                              {report.results.map((r, i) => {
                                const infoR = getVerdictInfo(r.verdict);
                                const test = selected.tests.find((t) => t.id === r.test_id) ?? selected.tests[i];
                                const isFail = r.verdict !== "Accepted";
                                return (
                                  <details
                                    key={r.test_id}
                                    open={isFail}
                                    className="bg-background rounded-lg border border-border open:border-border animate-fade-in"
                                  >
                                    <summary className="flex items-center justify-between px-3 py-2 cursor-pointer list-none">
                                      <span className="text-sm font-medium">Test {i + 1}</span>
                                      <span className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground tabular-nums">{r.time_ms}ms</span>
                                        <VerdictBadge verdict={r.verdict} />
                                      </span>
                                    </summary>
                                    <div className="px-3 pb-3 pt-2 border-t border-border">
                                      <div className="text-xs text-muted-foreground mb-1">
                                        {infoR.long}: {infoR.description}
                                      </div>
                                      {test && (
                                        <div className="grid gap-3 mt-2">
                                          <div>
                                            <div className="text-xs font-semibold text-foreground mb-1">Input</div>
                                            <pre className="bg-black/40 rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-border font-mono">
                                              {test.input || "(empty)"}
                                            </pre>
                                          </div>
                                          {r.verdict === "WrongAnswer" && r.actual_output != null ? (
                                            <DiffViewer expected={test.expected_output || ""} actual={r.actual_output || ""} />
                                          ) : (
                                            <>
                                              <div>
                                                <div className="text-xs font-semibold text-foreground mb-1">Expected output</div>
                                                <pre className="bg-black/40 rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-border font-mono">
                                                  {test.expected_output || "(empty)"}
                                                </pre>
                                              </div>
                                              {r.actual_output != null && (
                                                <div>
                                                  <div className="text-xs font-semibold text-foreground mb-1">Your output</div>
                                                  <pre
                                                    className={`rounded-md p-2 text-xs whitespace-pre-wrap break-words border font-mono ${
                                                      isFail ? "bg-wa/10 border-wa/30" : "bg-black/40 border-border"
                                                    }`}
                                                  >
                                                    {r.actual_output || "(no output)"}
                                                  </pre>
                                                </div>
                                              )}
                                            </>
                                          )}
                                          {r.message && (
                                            <div>
                                              <div className="text-xs font-semibold text-foreground mb-1">Runtime output</div>
                                              <pre className="bg-re/10 border border-re/30 rounded-md p-2 text-xs whitespace-pre-wrap break-words font-mono">
                                                {r.message}
                                              </pre>
                                            </div>
                                          )}
                                          {r.verdict === "WrongAnswer" && r.actual_output != null && test && (
                                            <div className="text-xs text-muted-foreground">
                                              Hint: comparison ignores trailing spaces per line. Check newlines.
                                            </div>
                                          )}
                                          {r.verdict === "TimeLimitExceeded" && (
                                            <div className="text-xs text-tle">
                                              Did not finish in {selected.time_limit_ms}ms. Look for infinite loops or O(n²).
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                );
                              })}
                              {isAC && <div className="text-xs text-ac mt-2">Submitted and logged. Keep going.</div>}
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
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a problem to start</div>
      )}
    </div>
  );
}
