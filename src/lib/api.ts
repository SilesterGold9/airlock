import { invoke } from "@tauri-apps/api/core";
import type { Contest, JudgeReport, Problem, Submission, SubmissionContext } from "./types";

export const api = {
  listProblems: () => invoke<Problem[]>("list_problems"),

  saveProblem: (problem: Problem) => invoke<Problem>("save_problem", { problem }),

  submitSolution: (args: {
    problemId: string;
    language: "cpp" | "java";
    sourceCode: string;
    context: SubmissionContext;
  }) =>
    invoke<JudgeReport>("submit_solution", {
      problemId: args.problemId,
      language: args.language,
      sourceCode: args.sourceCode,
      context: args.context,
    }),

  createContest: (args: { name: string; problemIds: string[]; durationMinutes: number }) =>
    invoke<Contest>("create_contest", {
      name: args.name,
      problemIds: args.problemIds,
      durationMinutes: args.durationMinutes,
    }),

  runStressTest: (args: {
    language: "cpp" | "java";
    candidateSrc: string;
    bruteForceSrc: string;
    generatorSrc: string;
    maxCases: number;
    timeLimitMs: number;
  }) =>
    invoke<[string, string, string] | null>("run_stress_test", {
      language: args.language,
      candidateSrc: args.candidateSrc,
      bruteForceSrc: args.bruteForceSrc,
      generatorSrc: args.generatorSrc,
      maxCases: args.maxCases,
      timeLimitMs: args.timeLimitMs,
    }),

  listSubmissions: () => invoke<Submission[]>("list_submissions"),

  listSubmissionsByProblem: (problemId: string) =>
    invoke<Submission[]>("list_submissions_by_problem", { problemId }),
};
