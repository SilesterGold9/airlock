import { useRef, useState } from "react";
import type { ReactNode } from "react";
import type { JudgeReport, TestCase, Verdict } from "../lib/types";
import { getVerdictInfo } from "../lib/verdict";
import VerdictBadge from "./VerdictBadge";
import DiffViewer from "./DiffViewer";
import { Icon, ToolButton } from "./PanelTabs";
import { useT } from "../lib/i18n";

export type ConsoleTab = "testcase" | "result";

const DOTS: Record<Verdict, string> = {
  Accepted: "bg-ac",
  WrongAnswer: "bg-wa",
  TimeLimitExceeded: "bg-tle",
  RuntimeError: "bg-re",
  CompileError: "bg-ce",
};

const CHEV = "M6 9l6 6 6-6";
const EXPAND = "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7";
const RESTORE = "M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3";

interface ResultConsoleProps {
  tests: TestCase[];
  timeLimitMs: number;
  report: JudgeReport | null;
  submitSeq: number;
  lastWasSubmit: boolean;
  tab: ConsoleTab;
  onTabChange: (tab: ConsoleTab) => void;
  open: boolean;
  onToggleOpen: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  expandTitle: string;
  restoreTitle: string;
  failureSlot?: ReactNode;
  // Judging state: skeleton rows replace the idle hint while compiling and
  // running, so the console never looks empty mid-flight.
  busy: boolean;
  runError?: string | null;
}

export default function ResultConsole({
  tests,
  timeLimitMs,
  report,
  submitSeq,
  lastWasSubmit,
  tab,
  onTabChange,
  open,
  onToggleOpen,
  expanded,
  onToggleExpand,
  expandTitle,
  restoreTitle,
  failureSlot,
  busy,
  runError,
}: ResultConsoleProps) {
  const t = useT();
  const [expandedCase, setExpandedCase] = useState<number | null>(null);
  const [height, setHeight] = useState(256);
  const dragging = useRef(false);

  const failCount =
    report && report.overall_verdict !== "Accepted"
      ? report.tests_total - report.tests_passed
      : 0;
  const slowest = report
    ? report.results.reduce((m, r) => Math.max(m, Number(r.time_ms) || 0), 0)
    : 0;

  function onGripDown(e: React.MouseEvent) {
    if (!open) return;
    dragging.current = true;
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setHeight(Math.max(140, Math.min(720, startH + (startY - ev.clientY))));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      data-tour="console"
      className="rounded-lg border border-border bg-card overflow-hidden shrink-0"
      style={open ? { height } : undefined}
    >
      {open && (
        <div
          onMouseDown={onGripDown}
          className="h-1.5 cursor-row-resize hover:bg-brand/60 transition-colors shrink-0"
          aria-hidden="true"
        />
      )}
      <div className={`flex items-center gap-0.5 px-2 h-11 border-b border-border shrink-0 ${open ? "" : "border-b-0"}`}>
        {(["testcase", "result"] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => {
              onTabChange(tb);
              if (!open) onToggleOpen();
            }}
            className={`relative flex items-center gap-1.5 px-2.5 h-11 text-[13px] font-medium transition-colors duration-150 ${
              tab === tb && open ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tb === "result" && (
              <span className={failCount > 0 ? "text-wa" : "text-ac"}>
                <Icon d={failCount > 0 ? CHEV : "M20 6L9 17l-5-5"} size={13} />
              </span>
            )}
            {t(`workspace.${tb === "testcase" ? "testcase" : "testresult"}`)}
            {tb === "result" && failCount > 0 && (
              <span className="text-[10px] tabular-nums bg-wa/15 text-wa rounded-full px-1.5 py-px">
                {failCount}
              </span>
            )}
            <span
              className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-foreground transition-transform duration-200 ${
                tab === tb && open ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </button>
        ))}
        <div className="ml-auto flex items-center gap-0.5">
          <ToolButton
            title={expanded ? restoreTitle : expandTitle}
            onClick={onToggleExpand}
          >
            <Icon d={expanded ? RESTORE : EXPAND} size={14} />
          </ToolButton>
          <ToolButton
            title={open ? t("workspace.collapseConsole") : t("workspace.expandConsole")}
            onClick={onToggleOpen}
          >
            <span className={`inline-block transition-transform duration-200 ${open ? "" : "rotate-180"}`}>
              <Icon d={CHEV} />
            </span>
          </ToolButton>
        </div>
      </div>
      {open && (
        <div className="h-[calc(100%-3.375rem)] overflow-y-auto px-4 py-3 animate-fade-in">
          {tab === "testcase" && (
            <div className="space-y-1">
              {tests.length === 0 && (
                <div className="text-xs text-muted-foreground">{t("workspace.none")}</div>
              )}
              {tests.map((tc, i) => (
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
          {tab === "result" && (
            <>
              {busy ? (
                <div className="animate-pulse" aria-label={t("practice.judging")}>
                  <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                    <div className="h-8 w-20 rounded-md bg-white/[0.07]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-2/5 rounded bg-white/[0.07]" />
                      <div className="h-3 w-3/5 rounded bg-white/[0.05]" />
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-2.5 px-1 py-2">
                        <div className="h-2 w-2 rounded-full bg-white/[0.08]" />
                        <div className="h-3 w-24 rounded bg-white/[0.06]" />
                        <div className="ml-auto h-3 w-16 rounded bg-white/[0.05]" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : runError ? (
                <div className="rounded-lg border border-wa/25 bg-wa/[0.04] p-3">
                  <div className="text-xs font-semibold text-wa">{t("common.failed")}</div>
                  <div className="text-xs text-muted-foreground mt-1 break-words">{runError}</div>
                </div>
              ) : !report ? (
                <div className="text-xs text-muted-foreground">{t("workspace.noResult")}</div>
              ) : (
                <div key={submitSeq} className="animate-pop">
                  {(() => {
                    const info = getVerdictInfo(report.overall_verdict);
                    const isCE = report.overall_verdict === "CompileError";
                    const isAC = report.overall_verdict === "Accepted";
                    return (
                      <>
                        <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                          <VerdictBadge verdict={report.overall_verdict} size="lg" showLong />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm leading-snug">{t(info.description)}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              {t(info.hint)}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 text-center">
                            <div>
                              <div className="text-base font-semibold tabular-nums leading-none">
                                {report.tests_passed}
                                <span className="text-muted-foreground font-normal">/{report.tests_total}</span>
                              </div>
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                                {t("practice.testsPassed")}
                              </div>
                            </div>
                            <div>
                              <div className="text-base font-semibold tabular-nums leading-none">
                                {slowest}
                                <span className="text-muted-foreground font-normal text-xs">ms</span>
                              </div>
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                                {t("practice.slowest")}
                              </div>
                            </div>
                            <div>
                              <div className="text-base font-semibold tabular-nums leading-none">
                                {timeLimitMs}
                                <span className="text-muted-foreground font-normal text-xs">ms</span>
                              </div>
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                                {t("practice.limit")}
                              </div>
                            </div>
                          </div>
                        </div>
                        {!isAC && lastWasSubmit && failureSlot}
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
                          <div className="mt-1 divide-y divide-white/[0.04]">
                            {report.results.map((r, i) => {
                              const infoR = getVerdictInfo(r.verdict);
                              const test =
                                tests.find((tt) => tt.id === r.test_id) ?? tests[i];
                              const isFail = r.verdict !== "Accepted";
                              return (
                                <details
                                  key={r.test_id}
                                  open={isFail}
                                  className="py-1 animate-fade-in"
                                >
                                  <summary className="flex items-center gap-2.5 px-1 py-1.5 cursor-pointer list-none rounded-md hover:bg-white/[0.02] transition-colors">
                                    <span className={`h-2 w-2 rounded-full shrink-0 ${DOTS[r.verdict]}`} />
                                    <span className="text-[13px] font-medium">
                                      {t("practice.test")} {i + 1}
                                    </span>
                                    <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                                      {r.time_ms}ms
                                    </span>
                                    <VerdictBadge verdict={r.verdict} />
                                  </summary>
                                  <div className="px-1 pb-3 pt-1">
                                    <div className="text-xs text-muted-foreground mb-2">
                                      {t(infoR.long)}: {t(infoR.description)}
                                    </div>
                                    {test && (
                                      <div className="grid gap-2">
                                        <div className="grid sm:grid-cols-2 gap-2">
                                          <div>
                                            <div className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">
                                              {t("common.input")}
                                            </div>
                                            <pre className="bg-white/[0.02] rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-white/[0.04] font-mono">
                                              {test.input || t("common.empty")}
                                            </pre>
                                          </div>
                                          <div>
                                            <div className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">
                                              {t("common.expectedOutput")}
                                            </div>
                                            <pre className="bg-white/[0.02] rounded-md p-2 text-xs whitespace-pre-wrap break-words border border-white/[0.04] font-mono">
                                              {test.expected_output || t("common.empty")}
                                            </pre>
                                          </div>
                                        </div>
                                        {r.verdict === "WrongAnswer" && r.actual_output != null ? (
                                          <DiffViewer
                                            expected={test.expected_output || ""}
                                            actual={r.actual_output || ""}
                                          />
                                        ) : (
                                          r.actual_output != null && (
                                            <div>
                                              <div className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">
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
                                          )
                                        )}
                                        {r.message && (
                                          <div>
                                            <div className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/70 mb-1">
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
                              <div className="text-xs text-ac pt-2">{t("practice.submittedHint")}</div>
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
  );
}
