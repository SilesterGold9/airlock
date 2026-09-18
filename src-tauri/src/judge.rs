use crate::models::{JudgeReport, TestCase, TestResult, Verdict};
use std::fs;
use std::io::Write;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tempfile::TempDir;
use wait_timeout::ChildExt;

/// Normalizes output for comparison: trims trailing whitespace on each line
/// and trailing blank lines, the way most judges do it. This is deliberately
/// forgiving about trailing newlines/spaces but strict about actual content.
fn normalize(s: &str) -> String {
    s.lines()
        .map(|l| l.trim_end())
        .collect::<Vec<_>>()
        .join("\n")
        .trim_end()
        .to_string()
}

pub fn run_judge(
    language: &str,
    source_code: &str,
    tests: &[TestCase],
    time_limit_ms: u64,
) -> Result<JudgeReport, String> {
    let workdir = TempDir::new().map_err(|e| e.to_string())?;
    let compile = compile_source(language, source_code, workdir.path())?;

    if let Some(err) = compile.compile_error {
        return Ok(JudgeReport {
            overall_verdict: Verdict::CompileError,
            results: vec![TestResult {
                test_id: "compile".into(),
                verdict: Verdict::CompileError,
                actual_output: None,
                time_ms: 0,
                message: Some(err),
            }],
            tests_passed: 0,
            tests_total: tests.len() as u32,
        });
    }

    let mut results = Vec::new();
    let mut overall = Verdict::Accepted;
    let mut passed = 0u32;

    for t in tests {
        let result = run_one_test(&compile, t, time_limit_ms)?;
        if matches!(result.verdict, Verdict::Accepted) {
            passed += 1;
        } else if matches!(overall, Verdict::Accepted) {
            overall = result.verdict.clone();
        }
        results.push(result);
    }

    Ok(JudgeReport {
        overall_verdict: overall,
        results,
        tests_passed: passed,
        tests_total: tests.len() as u32,
    })
}

struct CompiledArtifact {
    /// Command + args to *run* the compiled/interpreted program.
    run_cmd: String,
    run_args: Vec<String>,
    compile_error: Option<String>,
    _workdir: TempDir,
}

fn compile_source(
    language: &str,
    source_code: &str,
    dir: &std::path::Path,
) -> Result<CompiledArtifact, String> {
    let workdir = TempDir::new().map_err(|e| e.to_string())?;
    match language {
        "cpp" | "c++" => {
            let src_path = dir.join("main.cpp");
            fs::write(&src_path, source_code).map_err(|e| e.to_string())?;
            let bin_path = dir.join("main_bin");
            let output = Command::new("g++")
                .args([
                    "-O2",
                    "-std=c++17",
                    "-o",
                    bin_path.to_str().unwrap(),
                    src_path.to_str().unwrap(),
                ])
                .output()
                .map_err(|e| format!("failed to invoke g++: {e}"))?;

            let compile_error = if output.status.success() {
                None
            } else {
                Some(String::from_utf8_lossy(&output.stderr).to_string())
            };

            Ok(CompiledArtifact {
                run_cmd: bin_path.to_str().unwrap().to_string(),
                run_args: vec![],
                compile_error,
                _workdir: workdir,
            })
        }
        "java" => {
            // Java requires the public class to be named "Main" -> Main.java
            let src_path = dir.join("Main.java");
            fs::write(&src_path, source_code).map_err(|e| e.to_string())?;
            let output = Command::new("javac")
                .args([src_path.to_str().unwrap()])
                .current_dir(dir)
                .output()
                .map_err(|e| format!("failed to invoke javac: {e}"))?;

            let compile_error = if output.status.success() {
                None
            } else {
                Some(String::from_utf8_lossy(&output.stderr).to_string())
            };

            Ok(CompiledArtifact {
                run_cmd: "java".to_string(),
                run_args: vec![
                    "-cp".to_string(),
                    dir.to_str().unwrap().to_string(),
                    "Main".to_string(),
                ],
                compile_error,
                _workdir: workdir,
            })
        }
        other => Err(format!("unsupported language: {other}")),
    }
}

fn run_one_test(
    artifact: &CompiledArtifact,
    test: &TestCase,
    time_limit_ms: u64,
) -> Result<TestResult, String> {
    let mut child = Command::new(&artifact.run_cmd)
        .args(&artifact.run_args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn program: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(test.input.as_bytes());
    }

    let start = Instant::now();
    let timeout = Duration::from_millis(time_limit_ms);
    let status = child
        .wait_timeout(timeout)
        .map_err(|e| format!("wait error: {e}"))?;
    let elapsed = start.elapsed().as_millis();

    match status {
        None => {
            // Timed out: kill it.
            let _ = child.kill();
            let _ = child.wait();
            Ok(TestResult {
                test_id: test.id.clone(),
                verdict: Verdict::TimeLimitExceeded,
                actual_output: None,
                time_ms: time_limit_ms as u128,
                message: None,
            })
        }
        Some(exit_status) => {
            let output = child.wait_with_output().map_err(|e| e.to_string())?;
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            if !exit_status.success() {
                return Ok(TestResult {
                    test_id: test.id.clone(),
                    verdict: Verdict::RuntimeError,
                    actual_output: Some(stdout),
                    time_ms: elapsed,
                    message: Some(truncate(&stderr, 2000)),
                });
            }

            let verdict = if normalize(&stdout) == normalize(&test.expected_output) {
                Verdict::Accepted
            } else {
                Verdict::WrongAnswer
            };

            Ok(TestResult {
                test_id: test.id.clone(),
                verdict,
                actual_output: Some(stdout),
                time_ms: elapsed,
                message: None,
            })
        }
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}... [truncated]", &s[..max])
    }
}

/// Stress test: run `candidate` and `brute_force` against randomly generated
/// inputs (produced by `generator_src`, itself a small program you write per
/// problem) until they disagree or `max_cases` is reached.
pub fn run_stress_test(
    language: &str,
    candidate_src: &str,
    brute_force_src: &str,
    generator_src: &str,
    max_cases: u32,
    time_limit_ms: u64,
) -> Result<Option<(String, String, String)>, String> {
    // (input, candidate_output, brute_output) of the first mismatch found, if any
    let gen_dir = TempDir::new().map_err(|e| e.to_string())?;
    let cand_dir = TempDir::new().map_err(|e| e.to_string())?;
    let brute_dir = TempDir::new().map_err(|e| e.to_string())?;

    let generator = compile_source(language, generator_src, gen_dir.path())?;
    if let Some(e) = generator.compile_error {
        return Err(format!("generator failed to compile: {e}"));
    }
    let candidate = compile_source(language, candidate_src, cand_dir.path())?;
    if let Some(e) = candidate.compile_error {
        return Err(format!("candidate failed to compile: {e}"));
    }
    let brute = compile_source(language, brute_force_src, brute_dir.path())?;
    if let Some(e) = brute.compile_error {
        return Err(format!("brute force failed to compile: {e}"));
    }

    for seed in 0..max_cases {
        let gen_input = run_capture(&generator, &seed.to_string())?;
        let cand_out = run_capture_stdin(&candidate, &gen_input, time_limit_ms)?;
        let brute_out = run_capture_stdin(&brute, &gen_input, time_limit_ms)?;
        if normalize(&cand_out) != normalize(&brute_out) {
            return Ok(Some((gen_input, cand_out, brute_out)));
        }
    }
    Ok(None)
}

fn run_capture(artifact: &CompiledArtifact, arg: &str) -> Result<String, String> {
    let output = Command::new(&artifact.run_cmd)
        .args(&artifact.run_args)
        .arg(arg)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn run_capture_stdin(
    artifact: &CompiledArtifact,
    input: &str,
    time_limit_ms: u64,
) -> Result<String, String> {
    let mut child = Command::new(&artifact.run_cmd)
        .args(&artifact.run_args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(input.as_bytes());
    }
    let timeout = Duration::from_millis(time_limit_ms);
    match child.wait_timeout(timeout).map_err(|e| e.to_string())? {
        None => {
            let _ = child.kill();
            let _ = child.wait();
            Ok(String::new())
        }
        Some(_) => {
            let output = child.wait_with_output().map_err(|e| e.to_string())?;
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Verdict;

    fn one_test(input: &str, expected: &str) -> Vec<TestCase> {
        vec![TestCase {
            id: "t1".to_string(),
            input: input.to_string(),
            expected_output: expected.to_string(),
        }]
    }

    const ADD: &str = r#"
#include <bits/stdc++.h>
using namespace std;
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);
    long long a, b;
    if (!(cin >> a >> b)) return 0;
    cout << a + b << "\n";
}
"#;

    #[test]
    fn normalize_ignores_trailing_whitespace_and_blank_lines() {
        assert_eq!(normalize("5  \n"), "5");
        assert_eq!(normalize("5\n\n\n"), "5");
        assert_eq!(normalize("1 2\n3   \n"), "1 2\n3");
        // inner spacing is significant
        assert_eq!(normalize("1  2\n"), "1  2");
        assert_eq!(normalize(""), "");
    }

    #[test]
    fn truncate_passes_short_strings_through() {
        assert_eq!(truncate("abc", 10), "abc");
        assert_eq!(truncate("abc", 3), "abc");
    }

    #[test]
    fn truncate_marks_long_strings() {
        let out = truncate("abcdefghij", 4);
        assert!(out.starts_with("abcd"), "keeps prefix: {out}");
        assert!(out.contains("truncated"), "marks truncation: {out}");
    }

    #[test]
    fn run_judge_accepts_correct_solution() {
        let report = run_judge("cpp", ADD, &one_test("2 3\n", "5\n"), 2000).unwrap();
        assert!(matches!(report.overall_verdict, Verdict::Accepted));
        assert_eq!(report.tests_passed, 1);
        assert_eq!(report.tests_total, 1);
    }

    #[test]
    fn run_judge_reports_wrong_answer() {
        let report = run_judge("cpp", ADD, &one_test("2 3\n", "6\n"), 2000).unwrap();
        assert!(matches!(report.overall_verdict, Verdict::WrongAnswer));
        assert_eq!(report.tests_passed, 0);
        assert_eq!(report.tests_total, 1);
    }

    #[test]
    fn run_judge_reports_compile_error() {
        let report = run_judge(
            "cpp",
            "this is not c++ {{{",
            &one_test("2 3\n", "5\n"),
            2000,
        )
        .unwrap();
        assert!(matches!(report.overall_verdict, Verdict::CompileError));
    }

    #[test]
    fn run_judge_counts_partial_passes() {
        let tests = vec![
            TestCase {
                id: "t1".to_string(),
                input: "2 3\n".to_string(),
                expected_output: "5\n".to_string(),
            },
            TestCase {
                id: "t2".to_string(),
                input: "1 1\n".to_string(),
                expected_output: "999\n".to_string(),
            },
        ];
        let report = run_judge("cpp", ADD, &tests, 2000).unwrap();
        assert!(matches!(report.overall_verdict, Verdict::WrongAnswer));
        assert_eq!(report.tests_passed, 1);
        assert_eq!(report.tests_total, 2);
        assert_eq!(report.results.len(), 2);
    }
}
