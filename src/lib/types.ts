export type Verdict =
  | "Accepted"
  | "WrongAnswer"
  | "TimeLimitExceeded"
  | "RuntimeError"
  | "CompileError";

export interface TestCase {
  id: string;
  input: string;
  expected_output: string;
}

export interface Problem {
  id: string;
  title: string;
  statement_md: string;
  tags: string[];
  difficulty: number;
  time_limit_ms: number;
  memory_limit_mb: number;
  source: string;
  tests: TestCase[];
  brute_force_src?: string | null;
  brute_force_lang?: string | null;
  notes_md?: string | null;
}

export interface TestResult {
  test_id: string;
  verdict: Verdict;
  actual_output?: string | null;
  time_ms: number;
  message?: string | null;
}

export interface JudgeReport {
  overall_verdict: Verdict;
  results: TestResult[];
  tests_passed: number;
  tests_total: number;
}

// serde's default externally-tagged representation: a unit variant serializes
// as a bare string, a struct variant as { VariantName: { ...fields } }.
export type SubmissionContext =
  | "Practice"
  | { Contest: { contest_id: string; upsolve?: boolean } };

export interface Submission {
  id: string;
  problem_id: string;
  language: string;
  source_code: string;
  verdict: Verdict;
  submitted_at: string;
  context: SubmissionContext;
}

export interface Contest {
  id: string;
  name: string;
  problem_ids: string[];
  duration_minutes: number;
  started_at?: string | null;
  penalty_minutes: number;
}
