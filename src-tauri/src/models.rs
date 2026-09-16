use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestCase {
    pub id: String,
    pub input: String,
    pub expected_output: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Problem {
    pub id: String,
    pub title: String,
    pub statement_md: String,
    pub tags: Vec<String>,
    // rough personal difficulty rating, e.g. 800-3500 CF-style, or your own scale
    pub difficulty: i32,
    pub time_limit_ms: u64,
    pub memory_limit_mb: u64,
    pub source: String, // e.g. "Codeforces 1500A", "ICPC Luanda 2024", "self-authored"
    pub tests: Vec<TestCase>,
    // optional brute-force reference solution for stress testing
    pub brute_force_src: Option<String>,
    pub brute_force_lang: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum Verdict {
    Accepted,
    WrongAnswer,
    TimeLimitExceeded,
    RuntimeError,
    CompileError,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestResult {
    pub test_id: String,
    pub verdict: Verdict,
    pub actual_output: Option<String>,
    pub time_ms: u128,
    pub message: Option<String>, // compiler/stderr output, truncated
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JudgeReport {
    pub overall_verdict: Verdict,
    pub results: Vec<TestResult>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Submission {
    pub id: String,
    pub problem_id: String,
    pub language: String,
    pub source_code: String,
    pub verdict: Verdict,
    pub submitted_at: String, // ISO 8601
    pub context: SubmissionContext,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum SubmissionContext {
    Practice,
    Contest { contest_id: String },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Contest {
    pub id: String,
    pub name: String,
    pub problem_ids: Vec<String>,
    pub duration_minutes: u32,
    pub started_at: Option<String>,
    pub penalty_minutes: u32, // ICPC default: 20
}
