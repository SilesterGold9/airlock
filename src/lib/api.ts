import { invoke } from "@tauri-apps/api/core";
import type { Contest, FailureCategory, JudgeReport, Problem, ProblemClaim, RankReflection, RankState, RankTheme, ReimplementationSchedule, Submission, SubmissionContext, Technique, TechniqueStatus } from "./types";

export const api = {
  listProblems: () => invoke<Problem[]>("list_problems"),

  saveProblem: (problem: Problem) => invoke<Problem>("save_problem", { problem }),

  updateProblemNotes: (problemId: string, notesMd: string) =>
    invoke<void>("update_problem_notes", { problemId, notesMd }),

  runSolution: (args: { problemId: string; language: "cpp" | "java"; sourceCode: string }) =>
    invoke<JudgeReport>("run_solution", {
      problemId: args.problemId,
      language: args.language,
      sourceCode: args.sourceCode,
    }),

  submitSolution: (args: {
    problemId: string;
    language: "cpp" | "java";
    sourceCode: string;
    context: SubmissionContext;
    hintsRevealed?: number | null;
  }) =>
    invoke<JudgeReport>("submit_solution", {
      problemId: args.problemId,
      language: args.language,
      sourceCode: args.sourceCode,
      context: args.context,
      hintsRevealed: args.hintsRevealed ?? null,
    }),

  createContest: (args: { name: string; problemIds: string[]; durationMinutes: number; teamMembers?: string[]; driver?: string | null }) =>
    invoke<Contest>("create_contest", {
      name: args.name,
      problemIds: args.problemIds,
      durationMinutes: args.durationMinutes,
      teamMembers: args.teamMembers,
      driver: args.driver,
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

  listContests: () => invoke<Contest[]>("list_contests"),

  upsertClaim: (args: { contestId: string; problemId: string; claimedBy: string; status: string }) =>
    invoke<void>("upsert_claim", {
      contestId: args.contestId,
      problemId: args.problemId,
      claimedBy: args.claimedBy,
      status: args.status,
    }),

  listClaims: (contestId: string) => invoke<ProblemClaim[]>("list_claims", { contestId }),

  setContestDriver: (contestId: string, driver: string) => invoke<void>("set_contest_driver", { contestId, driver }),

  clearSubmissions: () => invoke<number>("clear_submissions"),

  clearAllData: () => invoke<void>("clear_all_data"),

  listTechniques: () => invoke<Technique[]>("list_techniques"),

  saveTechnique: (name: string) => invoke<Technique>("save_technique", { name }),

  updateTechniqueStatus: (techniqueId: string, status: TechniqueStatus) =>
    invoke<void>("update_technique_status", { techniqueId, status }),

  updateTechniqueNotes: (techniqueId: string, notesMd: string) =>
    invoke<void>("update_technique_notes", { techniqueId, notesMd }),

  bulkUpdateTechniqueStatus: (techniqueIds: string[], status: TechniqueStatus) =>
    invoke<number>("bulk_update_technique_status", { techniqueIds, status }),

  classifySubmission: (problemId: string, failureCategory: FailureCategory) =>
    invoke<void>("classify_submission", { problemId, failureCategory }),

  touchTechnique: (techniqueId: string) =>
    invoke<void>("touch_technique", { techniqueId }),

  listDueReimplementations: () =>
    invoke<ReimplementationSchedule[]>("list_due_reimplementations"),

  listRankThemes: () => invoke<RankTheme[]>("list_rank_themes"),

  createRankTheme: (args: { systemName: string; tierNames: string[]; tierColors: string[] }) =>
    invoke<RankTheme>("create_rank_theme", {
      systemName: args.systemName,
      tierNames: args.tierNames,
      tierColors: args.tierColors,
    }),

  setActiveTheme: (themeId: string) =>
    invoke<RankState>("set_active_theme", { themeId }),

  getRankState: () => invoke<RankState>("get_rank_state"),

  checkRankSuggestion: () => invoke<RankState>("check_rank_suggestion"),

  confirmRankUp: (starLevel: number, reflectionMd: string) =>
    invoke<RankState>("confirm_rank_up", { starLevel, reflectionMd }),

  listRankReflections: () => invoke<RankReflection[]>("list_rank_reflections"),

  seedSampleProblems: () => invoke<number>("seed_sample_problems"),

  importPack: (args: {
    techniques: { id: string; name: string }[];
    problems: Problem[];
  }) =>
    invoke<{ techniques_inserted: number; techniques_kept: number; problems_imported: number }>(
      "import_pack",
      { techniques: args.techniques, problems: args.problems }
    ),
};
