import type { CodeLanguage } from "./templates";

// Per-problem drafts so switching problems never destroys unsent code.
// Small strings in localStorage; quota failures are swallowed.
function key(problemId: string, language: CodeLanguage): string {
  return `airlock.draft.${problemId}.${language}`;
}

export function loadDraft(problemId: string, language: CodeLanguage): string | null {
  try {
    return localStorage.getItem(key(problemId, language));
  } catch {
    return null;
  }
}

export function saveDraft(problemId: string, language: CodeLanguage, code: string): void {
  try {
    if (!code) {
      localStorage.removeItem(key(problemId, language));
      return;
    }
    localStorage.setItem(key(problemId, language), code);
  } catch {
    // storage full or unavailable: drafts are best-effort
  }
}
