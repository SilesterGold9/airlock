import { describe, expect, it } from "vitest";
import {
  generateSet,
  latestAttemptByProblem,
  pickForSlot,
  typicalDifficulty,
} from "./trainingSet";
import type { Problem, Submission, Technique } from "./types";

function tech(id: string, name: string, status: Technique["status"]): Technique {
  return { id, name, status, status_updated_at: "", notes_md: null };
}

function prob(id: string, difficulty: number, primary_technique_id: string | null): Problem {
  return {
    id,
    title: id,
    statement_md: "",
    tags: [],
    difficulty,
    time_limit_ms: 1000,
    memory_limit_mb: 256,
    source: "",
    tests: [],
    primary_technique_id,
    hints: [],
  };
}

const TECHNIQUES = [
  tech("t1", "Prefix Sum", "Assimilated"),
  tech("t2", "Binary Search", "Learning"),
  tech("t3", "DP", "Rusty"),
];

const PROBLEMS = [
  prob("p1", 800, "t1"),
  prob("p2", 1200, "t2"),
  prob("p3", 2000, null),
  prob("p4", 900, "t1"),
  prob("p5", 800, null),
];

const DAY = 86400000;

function sub(problem_id: string, daysAgo: number, now: number): Submission {
  return {
    id: `${problem_id}-${daysAgo}`,
    problem_id,
    language: "cpp",
    source_code: "",
    verdict: "Accepted",
    submitted_at: new Date(now - daysAgo * DAY).toISOString(),
    context: "Practice",
  };
}

describe("typicalDifficulty", () => {
  it("uses the median, falls back with an empty vault", () => {
    expect(typicalDifficulty(PROBLEMS)).toBe(900);
    expect(typicalDifficulty([])).toBe(1200);
  });
});

describe("generateSet", () => {
  it("fills confidence/target/stretch/review without duplicates", () => {
    const now = Date.now();
    const subs = [sub("p4", 15, now), sub("p1", 1, now)];
    const set = generateSet(PROBLEMS, TECHNIQUES, subs, now, 10, []);
    // review is the most constrained slot: the only stale Assimilated problem
    expect(set.review?.id).toBe("p4");
    expect(set.confidence?.id).toBe("p1");
    expect(set.target?.id).toBe("p2");
    expect(set.stretch?.id).toBe("p3");
    expect(new Set(Object.values(set).map((p) => p!.id)).size).toBe(4);
  });

  it("returns nulls on an empty vault", () => {
    const set = generateSet([], [], [], Date.now(), 10, []);
    expect(Object.values(set)).toEqual([null, null, null, null]);
  });

  it("never-attempted Assimilated problems are not review picks", () => {
    const set = generateSet(PROBLEMS, TECHNIQUES, [], Date.now(), 10, []);
    expect(set.review).toBeNull();
  });

  it("respects the exclude list", () => {
    const now = Date.now();
    const subs = [sub("p4", 15, now)];
    const set = generateSet(PROBLEMS, TECHNIQUES, subs, now, 10, ["p4", "p1", "p2", "p3", "p5"]);
    expect(Object.values(set).every((p) => p === null)).toBe(true);
  });
});

describe("pickForSlot", () => {
  it("returns null when everything is excluded", () => {
    const now = Date.now();
    const subs = [sub("p4", 15, now)];
    const latest = latestAttemptByProblem(subs);
    const pick = pickForSlot(
      "review",
      PROBLEMS,
      TECHNIQUES,
      latest,
      now,
      10,
      900,
      new Set(["p1", "p2", "p3", "p4", "p5"])
    );
    expect(pick).toBeNull();
  });
});
