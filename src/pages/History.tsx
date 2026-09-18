import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Problem, Submission } from "../lib/types";
import VerdictBadge from "../components/VerdictBadge";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Select } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { computeRating } from "../lib/rating";
import { useT } from "../lib/i18n";

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function groupByTag(problems: Problem[], submissions: Submission[]) {
  const problemMap = new Map(problems.map((p) => [p.id, p]));
  const tagStats = new Map<string, { total: number; ac: number }>();
  for (const s of submissions) {
    const p = problemMap.get(s.problem_id);
    if (!p) continue;
    for (const tag of p.tags) {
      const cur = tagStats.get(tag) || { total: 0, ac: 0 };
      cur.total += 1;
      if (s.verdict === "Accepted") cur.ac += 1;
      tagStats.set(tag, cur);
    }
  }
  return Array.from(tagStats.entries())
    .map(([tag, v]) => ({ tag, ...v, rate: v.total ? v.ac / v.total : 0 }))
    .sort((a, b) => b.rate - a.rate);
}

export default function History() {
  const t = useT();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterVerdict, setFilterVerdict] = useState<string>("all");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [clearing, setClearing] = useState(false);
  const [includeUpsolve, setIncludeUpsolve] = useState(false);

  useEffect(() => {
    api.listProblems().then(setProblems).catch(console.error);
    api.listSubmissions().then(setSubmissions).catch(console.error);
  }, []);

  const problemMap = useMemo(() => new Map(problems.map((p) => [p.id, p])), [problems]);
  const allTags = useMemo(() => Array.from(new Set(problems.flatMap((p) => p.tags))).sort(), [problems]);

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      if (filterVerdict !== "all" && s.verdict !== filterVerdict) return false;
      if (filterTag !== "all") {
        const p = problemMap.get(s.problem_id);
        if (!p || !p.tags.includes(filterTag)) return false;
      }
      const isUpsolve = typeof s.context !== "string" && (s.context as { Contest?: { upsolve?: boolean } }).Contest?.upsolve;
      if (!includeUpsolve && isUpsolve) return false;
      return true;
    });
  }, [submissions, filterTag, filterVerdict, problemMap, includeUpsolve]);

  const visibleSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const isUpsolve = typeof s.context !== "string" && (s.context as { Contest?: { upsolve?: boolean } }).Contest?.upsolve;
      return includeUpsolve || !isUpsolve;
    });
  }, [submissions, includeUpsolve]);

  const stats = useMemo(() => {
    const total = visibleSubmissions.length;
    const ac = visibleSubmissions.filter((s) => s.verdict === "Accepted").length;
    const rate = total ? (ac / total) * 100 : 0;
    const byDay = new Map<string, number>();
    for (const s of visibleSubmissions) {
      const day = s.submitted_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + 1);
    }
    const days = Array.from(byDay.entries()).sort().slice(-14);
    return { total, ac, rate, days };
  }, [visibleSubmissions]);

  const perTag = useMemo(() => groupByTag(problems, visibleSubmissions), [problems, visibleSubmissions]);

  const ratingInfo = useMemo(() => computeRating(problems, visibleSubmissions), [problems, visibleSubmissions]);

  async function handleClear() {
    if (submissions.length === 0) return;
    const ok = window.confirm(t("history.confirmClear").replace("{count}", String(submissions.length)));
    if (!ok) return;
    setClearing(true);
    try {
      await api.clearSubmissions();
      setSubmissions([]);
      setSelected(null);
    } catch (e) {
      console.error(e);
      alert(String(e));
    } finally {
      setClearing(false);
    }
  }

  async function handleResetAll() {
    const ok = window.confirm(t("history.confirmReset"));
    if (!ok) return;
    setClearing(true);
    try {
      await api.clearAllData();
      setSubmissions([]);
      setSelected(null);
    } catch (e) {
      console.error(e);
      alert(String(e));
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 animate-fade-in space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t("history.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("history.subtitle")}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={handleClear} disabled={clearing || submissions.length === 0}>
            {clearing ? t("common.clearing") : t("common.clearHistory")}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleResetAll} disabled={clearing} title={t("history.resetTooltip")}>
            {t("common.resetAll")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t("history.totalSubs")}</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{stats.total}</div>
          <div className="text-xs text-muted-foreground tabular-nums">{stats.ac} {t("history.acceptedCount")}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t("history.accuracy")}</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{stats.rate.toFixed(1)}%</div>
          <div className="w-full h-1.5 bg-white/[0.06] rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-ac transition-all duration-500" style={{ width: `${stats.rate}%` }} />
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t("history.rating")}</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{ratingInfo.rating}</div>
          <div className="text-xs text-muted-foreground">{t("history.eloTrend")}</div>
          <div className="flex items-end gap-0.5 h-8 mt-2">
            {ratingInfo.history.slice(-10).map((h, i) => {
              const max = Math.max(...ratingInfo.history.map((x) => x.rating), 1600);
              const min = Math.min(...ratingInfo.history.map((x) => x.rating), 1000);
              const range = Math.max(1, max - min);
              return <div key={i} className="flex-1 bg-ac/60 rounded-sm" style={{ height: `${((h.rating - min) / range) * 24 + 4}px` }} title={`${h.date}: ${h.rating}`} />;
            })}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t("history.last14Days")}</div>
          <div className="flex items-end gap-1 h-10 mt-2">
            {stats.days.length === 0 ? (
              <span className="text-xs text-muted-foreground">{t("history.noData")}</span>
            ) : (
              stats.days.map(([day, count]) => {
                const max = Math.max(...stats.days.map(([, c]) => c), 1);
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-ac/60 rounded-sm transition-all duration-300" style={{ height: `${(count / max) * 32 + 4}px` }} title={`${day}: ${count}`} />
                    <span className="text-[10px] text-muted-foreground hidden md:block">{day.slice(5)}</span>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="text-sm font-semibold mb-2">{t("history.perTag")}</div>
        {perTag.length === 0 ? (
          <div className="text-xs text-muted-foreground">{t("history.noTagged")}</div>
        ) : (
          <div className="space-y-1.5">
            {perTag.map((pt) => (
              <div key={pt.tag} className="flex items-center gap-3 px-1 py-1 rounded-md hover:bg-white/[0.04] transition-colors duration-150">
                <span className="text-xs w-24 truncate">
                  <Badge variant="outline">{pt.tag}</Badge>
                </span>
                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-ac transition-all duration-500" style={{ width: `${pt.rate * 100}%` }} />
                </div>
                <span className="text-xs tabular-nums w-20 text-right text-muted-foreground">
                  {pt.ac}/{pt.total} {(pt.rate * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border flex flex-wrap gap-2 items-center">
          <span className="text-sm font-semibold">{t("history.submissions")}</span>
          <div className="w-32">
            <Select size="sm" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
              <option value="all">{t("practice.allTags")}</option>
              {allTags.map((tg) => (
                <option key={tg} value={tg}>{tg}</option>
              ))}
            </Select>
          </div>
          <div className="w-36">
            <Select size="sm" value={filterVerdict} onChange={(e) => setFilterVerdict(e.target.value)}>
              <option value="all">{t("history.allVerdicts")}</option>
              <option value="Accepted">{t("verdict.Accepted")}</option>
              <option value="WrongAnswer">{t("verdict.WrongAnswer")}</option>
              <option value="TimeLimitExceeded">TLE</option>
              <option value="RuntimeError">RE</option>
              <option value="CompileError">CE</option>
            </Select>
          </div>
          <label className="flex items-center gap-1.5 text-xs ml-auto cursor-pointer">
            <input type="checkbox" checked={includeUpsolve} onChange={(e) => setIncludeUpsolve(e.target.checked)} className="h-3 w-3 rounded border-input bg-input" />
            <span className="text-muted-foreground">{t("common.includeUpsolve")}</span>
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">{filtered.length} {t("history.shownCount")}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="m-3 text-xs text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg bg-white/[0.02]">{t("history.noMatch")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border bg-white/[0.02]">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">{t("history.colTime")}</th>
                  <th className="text-left px-3 py-2 font-medium">{t("history.colProblem")}</th>
                  <th className="text-left px-3 py-2 font-medium">{t("history.colLang")}</th>
                  <th className="text-left px-3 py-2 font-medium">{t("history.colVerdict")}</th>
                  <th className="text-left px-3 py-2 font-medium">{t("history.colContext")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const p = problemMap.get(s.problem_id);
                  const isSelected = selected?.id === s.id;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelected(isSelected ? null : s)}
                      className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.04] cursor-pointer transition-colors duration-150 ${isSelected ? "bg-white/[0.06]" : ""}`}
                    >
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap tabular-nums text-muted-foreground">{formatTime(s.submitted_at)}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-sm leading-tight">{p?.title || s.problem_id.slice(0, 8)}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">{p?.difficulty ?? ""}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline">{s.language}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <VerdictBadge verdict={s.verdict} />
                        {s.failure_category && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {t(`failure.${s.failure_category}`)}
                          </div>
                        )}
                        {s.hints_revealed != null && s.hints_revealed > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                            {t("history.hintsUsed").replace("{count}", String(s.hints_revealed))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span>{typeof s.context === "string" ? t("nav.practice") : s.context.Contest ? `${t("nav.contest")} ${s.context.Contest.contest_id.slice(0, 6)}` : t("nav.practice")}</span>
                          {typeof s.context !== "string" && (s.context as { Contest?: { upsolve?: boolean } }).Contest?.upsolve && (
                            <Badge variant="outline" className="text-tle border-tle/30 bg-tle/10 text-[10px] px-1 py-0">
                              {t("common.upsolve")}
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <div className="border-t border-border p-3 bg-black/20 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{t("history.sourceCode")}</span>
              <VerdictBadge verdict={selected.verdict} showLong />
            </div>
            <pre className="bg-black/40 border border-border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-words max-h-64 overflow-auto">
              {selected.source_code}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
}
