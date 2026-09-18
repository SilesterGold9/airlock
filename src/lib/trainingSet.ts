import type { Problem, Submission, Technique } from "./types";

export type SlotKind = "confidence" | "target" | "stretch" | "review";

export const SLOT_ORDER: SlotKind[] = ["confidence", "target", "stretch", "review"];

export type TrainingSet = Record<SlotKind, Problem | null>;

// "Comfortable range" anchor: median difficulty of the vault.
// Falls back to 1200 (upper end of CF div2-A) when the vault is empty.
export function typicalDifficulty(problems: Problem[]): number {
  if (problems.length === 0) return 1200;
  const ds = problems.map((p) => p.difficulty).sort((a, b) => a - b);
  const mid = Math.floor(ds.length / 2);
  return ds.length % 2 === 1 ? ds[mid] : Math.round((ds[mid - 1] + ds[mid]) / 2);
}

export function latestAttemptByProblem(submissions: Submission[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of submissions) {
    const t = new Date(s.submitted_at).getTime();
    if (Number.isNaN(t)) continue;
    const prev = m.get(s.problem_id);
    if (prev === undefined || t > prev) m.set(s.problem_id, t);
  }
  return m;
}

function techniqueStatusOf(p: Problem, byId: Map<string, Technique>): string | null {
  if (!p.primary_technique_id) return null;
  return byId.get(p.primary_technique_id)?.status ?? null;
}

function pickRandom(pool: Problem[], exclude: Set<string>): Problem | null {
  const open = pool.filter((p) => !exclude.has(p.id));
  if (open.length === 0) return null;
  return open[Math.floor(Math.random() * open.length)];
}

function poolForSlot(
  slot: SlotKind,
  problems: Problem[],
  byId: Map<string, Technique>,
  latestAttempt: Map<string, number>,
  now: number,
  reviewDays: number,
  typical: number,
): Problem[] {
  switch (slot) {
    case "confidence":
      return problems.filter(
        (p) => techniqueStatusOf(p, byId) === "Assimilated" && p.difficulty <= typical
      );
    case "target":
      return problems.filter((p) => techniqueStatusOf(p, byId) === "Learning");
    case "stretch":
      return problems.filter((p) => p.difficulty > typical);
    case "review": {
      const cutoff = now - reviewDays * 86400000;
      return problems.filter((p) => {
        if (techniqueStatusOf(p, byId) !== "Assimilated") return false;
        const last = latestAttempt.get(p.id);
        return last !== undefined && last < cutoff;
      });
    }
  }
}

export function pickForSlot(
  slot: SlotKind,
  problems: Problem[],
  techniques: Technique[],
  latestAttempt: Map<string, number>,
  now: number,
  reviewDays: number,
  typical: number,
  exclude: Set<string>,
): Problem | null {
  const byId = new Map(techniques.map((x) => [x.id, x]));
  return pickRandom(
    poolForSlot(slot, problems, byId, latestAttempt, now, reviewDays, typical),
    exclude
  );
}

export function generateSet(
  problems: Problem[],
  techniques: Technique[],
  submissions: Submission[],
  now: number,
  reviewDays: number,
  excludeIds: string[] = [],
): TrainingSet {
  const byId = new Map(techniques.map((x) => [x.id, x]));
  const latestAttempt = latestAttemptByProblem(submissions);
  const typical = typicalDifficulty(problems);
  const poolSize = (slot: SlotKind) =>
    poolForSlot(slot, problems, byId, latestAttempt, now, reviewDays, typical).length;
  // Fill the most constrained slots first so a scarce candidate (e.g. the
  // only stale review problem) is not eaten by an earlier, looser slot.
  // Display order stays SLOT_ORDER regardless of fill order.
  const fillOrder = [...SLOT_ORDER].sort(
    (a, b) => poolSize(a) - poolSize(b) || SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b)
  );
  const exclude = new Set(excludeIds);
  const out = {} as TrainingSet;
  for (const slot of fillOrder) {
    const p = pickRandom(
      poolForSlot(slot, problems, byId, latestAttempt, now, reviewDays, typical),
      exclude
    );
    out[slot] = p;
    if (p) exclude.add(p.id);
  }
  return out;
}
