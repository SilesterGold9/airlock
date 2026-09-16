import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Problem, Submission } from "../lib/types";
import VerdictBadge from "../components/VerdictBadge";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Select } from "../components/ui/select";

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
  const [problems, setProblems] = useState<Problem[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterVerdict, setFilterVerdict] = useState<string>("all");
  const [selected, setSelected] = useState<Submission | null>(null);

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
      return true;
    });
  }, [submissions, filterTag, filterVerdict, problemMap]);

  const stats = useMemo(() => {
    const total = submissions.length;
    const ac = submissions.filter((s) => s.verdict === "Accepted").length;
    const rate = total ? (ac / total) * 100 : 0;
    const byDay = new Map<string, number>();
    for (const s of submissions) {
      const day = s.submitted_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + 1);
    }
    const days = Array.from(byDay.entries()).sort().slice(-14);
    return { total, ac, rate, days };
  }, [submissions]);

  const perTag = useMemo(() => groupByTag(problems, submissions), [problems, submissions]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold">History and stats</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every Practice and Contest submission is logged. Filter by tag or verdict, inspect code, track accuracy.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total submissions</div>
          <div className="text-2xl font-semibold mt-1">{stats.total}</div>
          <div className="text-xs text-muted-foreground">{stats.ac} accepted</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Accuracy</div>
          <div className="text-2xl font-semibold mt-1">{stats.rate.toFixed(1)}%</div>
          <div className="w-full h-1.5 bg-white/[0.06] rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-ac transition-all duration-500" style={{ width: `${stats.rate}%` }} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Last 14 days</div>
          <div className="flex items-end gap-1 h-10 mt-2">
            {stats.days.length === 0 ? (
              <span className="text-xs text-muted-foreground">No data yet</span>
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

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Per-tag accuracy</div>
        {perTag.length === 0 ? (
          <div className="text-xs text-muted-foreground">No tagged submissions yet. Submit in Practice to see breakdown.</div>
        ) : (
          <div className="space-y-2">
            {perTag.map((t) => (
              <div key={t.tag} className="flex items-center gap-3">
                <span className="text-xs w-24 truncate">
                  <Badge variant="outline">{t.tag}</Badge>
                </span>
                <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-ac transition-all duration-500" style={{ width: `${t.rate * 100}%` }} />
                </div>
                <span className="text-xs tabular-nums w-20 text-right">
                  {t.ac}/{t.total} {(t.rate * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap gap-3 items-center">
          <span className="text-sm font-medium">Submissions</span>
          <div className="w-36">
            <Select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="h-8 text-xs">
              <option value="all">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select value={filterVerdict} onChange={(e) => setFilterVerdict(e.target.value)} className="h-8 text-xs">
              <option value="all">All verdicts</option>
              <option value="Accepted">Accepted</option>
              <option value="WrongAnswer">WrongAnswer</option>
              <option value="TimeLimitExceeded">TLE</option>
              <option value="RuntimeError">RE</option>
              <option value="CompileError">CE</option>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} shown</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No submissions match the filter. Try submitting a solution.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border bg-white/[0.02]">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Time</th>
                  <th className="text-left px-3 py-2 font-medium">Problem</th>
                  <th className="text-left px-3 py-2 font-medium">Lang</th>
                  <th className="text-left px-3 py-2 font-medium">Verdict</th>
                  <th className="text-left px-3 py-2 font-medium">Context</th>
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
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{formatTime(s.submitted_at)}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium leading-tight">{p?.title || s.problem_id.slice(0, 8)}</div>
                        <div className="text-xs text-muted-foreground">{p?.difficulty ?? ""}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline">{s.language}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <VerdictBadge verdict={s.verdict} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {typeof s.context === "string" ? s.context : s.context.Contest ? `Contest ${s.context.Contest.contest_id.slice(0, 6)}` : "Practice"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <div className="border-t border-border p-4 bg-black/20 animate-slide-up">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold">Source code</span>
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
