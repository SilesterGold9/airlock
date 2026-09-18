use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    pub notes_md: Option<String>,
    // technique this problem targets (drives the structured set generator)
    #[serde(default)]
    pub primary_technique_id: Option<String>,
    // ordered hint ladder, index 0 = level 1, up to 7 (level 7 may contain code)
    #[serde(default)]
    pub hints: Vec<String>,
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
    pub tests_passed: u32,
    pub tests_total: u32,
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
    // set after a non-AC verdict via classify_submission; None = unclassified
    #[serde(default)]
    pub failure_category: Option<FailureCategory>,
    // hints revealed before this attempt; None = none (or contest mode)
    #[serde(default)]
    pub hints_revealed: Option<u8>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum FailureCategory {
    Conceptual,
    Implementation,
    StlGap,
    Indexing,
    Careless,
    MisreadStatement,
    PrematureTechnique,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum SubmissionContext {
    Practice,
    Contest {
        contest_id: String,
        #[serde(default)]
        upsolve: bool,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Contest {
    pub id: String,
    pub name: String,
    pub problem_ids: Vec<String>,
    pub duration_minutes: u32,
    pub started_at: Option<String>,
    pub penalty_minutes: u32, // ICPC default: 20
    #[serde(default)]
    pub team_members: Vec<String>,
    pub driver: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProblemClaim {
    pub contest_id: String,
    pub problem_id: String,
    pub claimed_by: String,
    pub status: String, // thinking | coding | stuck | done
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum TechniqueStatus {
    NotStarted,
    Learning,
    Assimilated,
    Rusty, // was Assimilated, needs reassessment
}

impl Default for TechniqueStatus {
    fn default() -> Self {
        TechniqueStatus::NotStarted
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Technique {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub status: TechniqueStatus,
    pub status_updated_at: String, // ISO 8601
    pub notes_md: Option<String>,
}

// Same-problem spaced repetition: created on first AC, advanced on each
// reimplement-AC. Intervals are +1 day, then +3, then +7 (capped there).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReimplementationSchedule {
    pub problem_id: String,
    pub last_ac_at: String,  // ISO 8601
    pub next_due_at: String, // ISO 8601
    pub completed_reimplementations: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RankTheme {
    pub id: String,
    pub system_name: String,
    pub tier_names: Vec<String>,  // exactly 8
    pub tier_colors: Vec<String>, // exactly 8 hex
    pub is_default: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RankState {
    pub theme_id: String,
    pub current_stars: u8,
    /// star ("1".."7") -> ISO date. String keys for serde_json map-key compat.
    #[serde(default)]
    pub achieved_at: HashMap<String, String>,
    #[serde(default)]
    pub pending_suggestion: Option<u8>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RankReflection {
    pub id: String,
    pub star_level: u8,
    pub reflection_md: String,
    pub created_at: String, // ISO 8601
}
