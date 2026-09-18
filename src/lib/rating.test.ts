import { describe, expect, it } from "vitest";
import { computeRating, getSimilarProblems } from "./rating";
import { VERDICT_INFO, getVerdictInfo } from "./verdict";
import type { Problem, Submission, Verdict } from "./types";

function prob(id: string, tags: string[], difficulty: number): Problem {
  return {
    id,
    title: id,
    statement_md: "",
    tags,
    difficulty,
    time_limit_ms: 1000,
    memory_limit_mb: 256,
    source: "",
    tests: [],
    hints: [],
  };
}

describe("getSimilarProblems", () => {
  const current = prob("cur", ["dp", "arrays"], 1200);
  const all = [
    current,
    prob("close", ["dp"], 1300),
    prob("far-diff", ["dp"], 2500),
    prob("no-tags", ["graphs"], 1200),
    prob("perfect", ["dp", "arrays"], 1200),
  ];

  it("ranks shared tags above difficulty gap, excludes current", () => {
    const out = getSimilarProblems(current, all);
    expect(out.map((p) => p.id)).toEqual(["perfect", "close"]);
    expect(out.some((p) => p.id === "cur")).toBe(false);
  });

  it("respects the limit", () => {
    expect(getSimilarProblems(current, all, 1).length).toBe(1);
  });
});

describe("computeRating", () => {
  function sub(problem_id: string, verdict: Submission["verdict"], day: string): Submission {
    return {
      id: `${problem_id}-${day}-${verdict}`,
      problem_id,
      language: "cpp",
      source_code: "",
      verdict,
      submitted_at: `${day}T10:00:00Z`,
      context: "Practice",
    };
  }

  it("starts at 1200 and never drops below 800", () => {
    const problems = [prob("p1", [], 800)];
    const subs = Array.from({ length: 20 }, (_, i) =>
      sub("p1", "WrongAnswer", `2026-01-${String(i + 1).padStart(2, "0")}`)
    );
    const { rating, history } = computeRating(problems, subs);
    expect(rating).toBe(800);
    expect(history[0]).toEqual({ date: "start", rating: 1200 });
    expect(history.length).toBe(21);
  });

  it("solving above your rating raises it", () => {
    const problems = [prob("p1", [], 2000)];
    const { rating } = computeRating(problems, [sub("p1", "Accepted", "2026-02-01")]);
    expect(rating).toBeGreaterThan(1200);
  });
});

describe("verdict info", () => {
  it("covers every verdict with display strings and styles", () => {
    const verdicts: Verdict[] = ["Accepted", "WrongAnswer", "TimeLimitExceeded", "RuntimeError", "CompileError"];
    for (const v of verdicts) {
      const info = getVerdictInfo(v);
      expect(info.short).toBeTruthy();
      expect(info.long).toBeTruthy();
      expect(info.description).toBeTruthy();
      expect(info.hint).toBeTruthy();
      expect(info.classes).toBeTruthy();
    }
    expect(VERDICT_INFO.Accepted.short).toBe("AC");
  });
});
