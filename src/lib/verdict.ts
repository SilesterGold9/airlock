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
    long: "verdict.Accepted",
    description: "verdict.Accepted.description",
    hint: "verdict.Accepted.hint",
    classes: "bg-ac/20 text-ac border-ac",
  },
  WrongAnswer: {
    short: "WA",
    long: "verdict.WrongAnswer",
    description: "verdict.WrongAnswer.description",
    hint: "verdict.WrongAnswer.hint",
    classes: "bg-wa/20 text-wa border-wa",
  },
  TimeLimitExceeded: {
    short: "TLE",
    long: "verdict.TimeLimitExceeded",
    description: "verdict.TimeLimitExceeded.description",
    hint: "verdict.TimeLimitExceeded.hint",
    classes: "bg-tle/20 text-tle border-tle",
  },
  RuntimeError: {
    short: "RE",
    long: "verdict.RuntimeError",
    description: "verdict.RuntimeError.description",
    hint: "verdict.RuntimeError.hint",
    classes: "bg-re/20 text-re border-re",
  },
  CompileError: {
    short: "CE",
    long: "verdict.CompileError",
    description: "verdict.CompileError.description",
    hint: "verdict.CompileError.hint",
    classes: "bg-ce/20 text-ce border-ce",
  },
};

export function getVerdictInfo(v: Verdict): VerdictInfo {
  return VERDICT_INFO[v];
}
