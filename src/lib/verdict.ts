import type { Verdict } from "./types";

export interface VerdictInfo {
  short: string;
  long: string;
  description: string;
  hint: string;
  classes: string;
}

export const VERDICT_INFO: Record<Verdict, VerdictInfo> = {
  Accepted: {
    short: "AC",
    long: "Accepted",
    description: "All tests passed. Nice work.",
    hint: "Your solution produced the correct output for every test case.",
    classes: "bg-ac/20 text-ac border-ac",
  },
  WrongAnswer: {
    short: "WA",
    long: "Wrong Answer",
    description: "Your program ran but the output was wrong.",
    hint: "Check the failing test below. Compare your output with the expected one character by character. Watch for extra spaces or missing newlines.",
    classes: "bg-wa/20 text-wa border-wa",
  },
  TimeLimitExceeded: {
    short: "TLE",
    long: "Time Limit Exceeded",
    description: "Your program took too long and was stopped.",
    hint: "The judge killed it after the time limit. You need a faster algorithm or to fix an infinite loop. Time limit is shown on the problem.",
    classes: "bg-tle/20 text-tle border-tle",
  },
  RuntimeError: {
    short: "RE",
    long: "Runtime Error",
    description: "Your program crashed while running.",
    hint: "This is usually a bad array access, division by zero, null pointer, or out of memory. The error output below may show the line.",
    classes: "bg-re/20 text-re border-re",
  },
  CompileError: {
    short: "CE",
    long: "Compilation Failed",
    description: "Your code did not compile.",
    hint: "Fix the compiler errors below and submit again. For C++ check missing semicolons and brackets. For Java the public class must be named Main.",
    classes: "bg-ce/20 text-ce border-ce",
  },
};

export function getVerdictInfo(v: Verdict): VerdictInfo {
  return VERDICT_INFO[v];
}
