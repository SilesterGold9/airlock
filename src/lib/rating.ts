import type { Problem, Submission } from "./types";

export function computeRating(problems: Problem[], submissions: Submission[]): { rating: number; history: { date: string; rating: number }[] } {
  const problemMap = new Map(problems.map((p) => [p.id, p]));
  let rating = 1200;
  const history: { date: string; rating: number }[] = [{ date: "start", rating }];
  const byDay = new Map<string, Submission[]>();
  for (const s of submissions) {
    const day = s.submitted_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(s);
  }
  const sortedDays = Array.from(byDay.keys()).sort();
  for (const day of sortedDays) {
    const daySubs = byDay.get(day)!;
    let dayDelta = 0;
    for (const s of daySubs) {
      const p = problemMap.get(s.problem_id);
      const diff = p?.difficulty ?? 1000;
      const expected = 1 / (1 + Math.pow(10, (diff - rating) / 400));
      const actual = s.verdict === "Accepted" ? 1 : 0;
      const k = 32;
      dayDelta += k * (actual - expected);
    }
    rating = Math.max(800, Math.round(rating + dayDelta / Math.max(1, daySubs.length)));
    history.push({ date: day, rating });
  }
  return { rating, history };
}

export function getSimilarProblems(current: Problem, all: Problem[], limit = 3): Problem[] {
  return all
    .filter((p) => p.id !== current.id)
    .map((p) => {
      const commonTags = p.tags.filter((t) => current.tags.includes(t)).length;
      const diffGap = Math.abs(p.difficulty - current.difficulty);
      const score = commonTags * 100 - diffGap;
      return { p, score, commonTags };
    })
    .filter((x) => x.commonTags > 0 && Math.abs(x.p.difficulty - current.difficulty) <= 600)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}
