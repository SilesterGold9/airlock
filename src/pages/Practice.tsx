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
import Balloons from "../components/Balloons";
import ProblemStatement from "../components/ProblemStatement";
import { getSimilarProblems } from "../lib/rating";
import { tracks } from "../lib/tracks";
import { useT } from "../lib/i18n";

export default function Practice() {
  const t = useT();
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
  const [attempts, setAttempts] = useState<import("../lib/types").Submission[]>([]);
  const [balloonTrigger, setBalloonTrigger] = useState(0);

  useEffect(() => {
    api.listProblems().then(setProblems).catch(console.error);
  }, []);

  useEffect(() => {
    setNotes(selected?.notes_md || "");
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
      if (result.overall_verdict === "Accepted") setBalloonTrigger((v) => v + 1);
      if (selected) {
        api.listSubmissionsByProblem(selected.id).then(setAttempts).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setJudging(false);
    }
  }

  return (
    <div className="flex h-full bg-background">
      <Balloons trigger={balloonTrigger} />
      {/* Problem list — LeetCode table treatment */}
      <aside className="w-80 border-r border-border overflow-y-auto shrink-0 bg-background flex flex-col">
        <div className="p-3 border-b border-border/50 bg-card/20 backdrop-blur-sm sticky top-0 z-10">
          <Select
            className="w-full"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="all">{t("practice.allTags")}</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-between mt-3 px-1">
            <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{visible.length} problems</span>
            <span className="text-xs text-muted-foreground tabular-nums">{problems.length} total</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
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
                      ? "bg-white/[0.06] border-l-2 border-l-brand"
                      : "hover:bg-white/[0.03] border-l-2 border-l-transparent hover:border-l-white/[0.08]"
                  }`}
                  onClick={() => {
                    setSelected(p);
                    setReport(null);
                    setCode("");
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm leading-tight truncate group-hover:text-foreground transition-colors">{p.title}</div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{p.source}</div>
                  </div>
                  <DifficultyBadge difficulty={p.difficulty} />
                </button>
              </li>
            ))}
          </ul>
        </div>
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
                  {selected.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                  <DifficultyBadge difficulty={selected.difficulty} />
                </div>
                <div className="text-xs text-muted-foreground mb-4 tabular-nums">
                  {t("practice.timeLimit")}: {selected.time_limit_ms}ms · {t("practice.memory")}: {selected.memory_limit_mb}MB
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-5 backdrop-blur-sm">
                  <ProblemStatement content={selected.statement_md} />
                </div>

                <Card className="mt-6">
                  <button
                    onClick={() => setNotesOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-sm font-semibold">{t("practice.myNotes")}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      {notesSaving ? t("practice.saving") : notes ? t("practice.saved") : t("practice.noNotes")}
                      <span className={`transition-transform ${notesOpen ? "rotate-180" : ""}`}>▾</span>
                    </span>
                  </button>
                  {notesOpen && (
                    <div className="px-4 pb-4">
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t("practice.notesPlaceholder")}
                        className="min-h-[140px] font-sans text-sm"
                      />
                      <div className="text-xs text-muted-foreground mt-2">
                        {t("practice.autosavedHint")}
                      </div>
                    </div>
                  )}
                </Card>

                {attempts.length > 0 && (
                  <Card className="mt-4 p-4">
                    <div className="text-xs font-semibold mb-2">{t("practice.lastAttempts")}</div>
                    <div className="space-y-1">
                      {attempts.slice(0, 3).map((a) => (
                        <div key={a.id} className="flex items-center gap-2 text-xs">
                          <VerdictBadge verdict={a.verdict} />
                          <span className="text-muted-foreground tabular-nums">{new Date(a.submitted_at).toLocaleDateString()}</span>
                          <span className="ml-auto font-mono text-xs">{a.language}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {(() => {
                  const similar = getSimilarProblems(selected, problems);
                  return similar.length > 0 ? (
                    <Card className="mt-4 p-4">
                      <div className="text-xs font-semibold mb-2">{t("practice.similarProblems")}</div>
                      <div className="space-y-1">
                        {similar.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSelected(p);
                              setReport(null);
                              setCode("");
                            }}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-white/[0.04] text-sm flex justify-between items-center"
                          >
                            <span className="truncate">{p.title}</span>
                            <DifficultyBadge difficulty={p.difficulty} />
                          </button>
                        ))}
                      </div>
                    </Card>
                  ) : null;
                })()}

                <Card className="mt-4 p-4">
                  <div className="text-xs font-semibold mb-2">{t("practice.skillTracks")}</div>
                  <div className="space-y-2">
                    {tracks.slice(0, 2).map((tr) => (
                      <div key={tr.id} className="border border-border rounded-lg p-2">
                        <div className="text-xs font-medium">{t(`tracks.${tr.id}.title`)}</div>
                        <div className="text-xs text-muted-foreground">{t(`tracks.${tr.id}.description`)}</div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {tr.steps.map((s) => (
                            <Badge key={s.title} variant="outline" className="text-xs">
                              {s.title}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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
                  {judging ? t("practice.judging") : t("practice.submit")}
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
                              <div className="font-semibold text-sm">{t(info.description)}</div>
                              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{t(info.hint)}</div>
                            </div>
                          </div>

                          {isCE ? (
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-foreground mb-1">{t("practice.compilerSays")}</div>
                              <pre className="bg-black/40 border border-border rounded-lg p-3 text-xs whitespace-pre-wrap break-words max-h-64 overflow-auto font-mono">
                                {report.results[0]?.message || t("practice.noCompilerDetails")}
                              </pre>
                              <div className="text-xs text-muted-foreground mt-2">
                                {t("practice.compileHint")}{" "}
                                <span className="text-foreground font-mono">public class Main</span>.
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2 mt-3">
                              <div className="text-xs font-semibold text-foreground">
                                {report.tests_passed}/{report.tests_total} {t("practice.testsPassed")}
                                <span className="font-normal text-muted-foreground ml-2">{t("practice.limit")} {selected.time_limit_ms}ms</span>
                                {!isAC && <span className="ml-2 text-wa">• {report.tests_total - report.tests_passed} {t("practice.failedCount")}</span>}
                              </div>
                              {report.results.map((r, i) => {
                                const infoR = getVerdictInfo(r.verdict);
                                const test = selected.tests.find((tt) => tt.id === r.test_id) ?? selected.tests[i];
                                const isFail = r.verdict !== "Accepted";
                                return (
                                  <details
                                    key={r.test_id}
                                    open={isFail}
                                    className="bg-white/[0.015] rounded-lg border border-white/[0.04] open:border-white/[0.06] open:bg-white/[0.02] animate-fade-in"
                                  >
                                    <summary className="flex items-center justify-between px-3 py-2 cursor-pointer list-none">
                                      <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">{t("practice.test")} {i + 1}</span>
                                      <span className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground tabular-nums">{r.time_ms}ms</span>
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
                                            <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">{t("common.input")}</div>
                                            <pre className="bg-white/[0.02] rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-white/[0.04] font-mono">
                                              {test.input || t("common.empty")}
                                            </pre>
                                          </div>
                                          {r.verdict === "WrongAnswer" && r.actual_output != null ? (
                                            <DiffViewer expected={test.expected_output || ""} actual={r.actual_output || ""} />
                                          ) : (
                                            <>
                                              <div>
                                                <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">{t("common.expectedOutput")}</div>
                                                <pre className="bg-white/[0.02] rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-white/[0.04] font-mono">
                                                  {test.expected_output || t("common.empty")}
                                                </pre>
                                              </div>
                                              {r.actual_output != null && (
                                                <div>
                                                  <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">{t("common.yourOutput")}</div>
                                                  <pre
                                                    className={`rounded-md p-2 text-xs whitespace-pre-wrap break-words border font-mono ${
                                                      isFail ? "bg-wa/[0.04] border-wa/20" : "bg-white/[0.02] border-white/[0.04]"
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
                                              <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">{t("practice.runtimeOutput")}</div>
                                              <pre className="bg-re/[0.04] border border-re/20 rounded-md p-2 text-xs whitespace-pre-wrap break-words font-mono">
                                                {r.message}
                                              </pre>
                                            </div>
                                          )}
                                          {r.verdict === "WrongAnswer" && r.actual_output != null && test && (
                                            <div className="text-xs text-muted-foreground">
                                              {t("practice.whitespaceHint")}
                                            </div>
                                          )}
                                          {r.verdict === "TimeLimitExceeded" && (
                                            <div className="text-xs text-tle">
                                              {t("practice.tleHint")}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                );
                              })}
                              {isAC && <div className="text-xs text-ac mt-2">{t("practice.submittedHint")}</div>}
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
        <div className="flex-1 flex items-center justify-center text-muted-foreground">{t("practice.selectProblem")}</div>
      )}
    </div>
  );
}
