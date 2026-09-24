import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Problem } from "../lib/types";
import LazyCodeEditor, { type CodeEditorHandle } from "../components/LazyCodeEditor";
import { usePersistentState } from "../lib/persist";
import VerdictBadge from "../components/VerdictBadge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useT } from "../lib/i18n";

const GEN_TEMPLATES: Record<"cpp" | "java", string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;
// generator: seed is argv[1], print one test case to stdout
int main(int argc, char* argv[]) {
    int seed = argc > 1 ? atoi(argv[1]) : 0;
    srand(seed);
    // example: random max subarray test
    int n = rand() % 10 + 1;
    cout << n << "\\n";
    for (int i = 0; i < n; i++) {
        cout << (rand() % 20 - 10) << (i + 1 == n ? '\\n' : ' ');
    }
    return 0;
}
`,
  java: `import java.util.*;
public class Main {
    public static void main(String[] args) {
        int seed = args.length > 0 ? Integer.parseInt(args[0]) : 0;
        Random rnd = new Random(seed);
        int n = rnd.nextInt(10) + 1;
        System.out.println(n);
        for (int i = 0; i < n; i++) {
            System.out.print((rnd.nextInt(20) - 10) + (i + 1 == n ? "\\n" : " "));
        }
    }
}
`,
};

const CANDIDATE_TEMPLATES: Record<"cpp" | "java", string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    // candidate solution: read one test case from stdin
    int n; if(!(cin>>n)) return 0;
    vector<long long> a(n);
    for(int i=0;i<n;i++) cin>>a[i];
    long long best = a[0], cur = a[0];
    for(int i=1;i<n;i++){ cur = max(a[i], cur+a[i]); best = max(best, cur); }
    cout<<best<<"\\n";
    return 0;
}
`,
  java: `import java.util.*;
public class Main {
    public static void main(String[] args) throws Exception {
        Scanner sc = new Scanner(System.in);
        if(!sc.hasNextInt()) return;
        int n = sc.nextInt();
        long[] a = new long[n];
        for(int i=0;i<n;i++) a[i]=sc.nextLong();
        long best=a[0], cur=a[0];
        for(int i=1;i<n;i++){ cur=Math.max(a[i], cur+a[i]); best=Math.max(best,cur); }
        System.out.println(best);
    }
}
`,
};

const BRUTE_TEMPLATES: Record<"cpp" | "java", string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;
int main(){
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n; if(!(cin>>n)) return 0;
    vector<long long> a(n);
    for(int i=0;i<n;i++) cin>>a[i];
    long long best = a[0];
    for(int l=0;l<n;l++){
        long long sum=0;
        for(int r=l;r<n;r++){ sum+=a[r]; best=max(best,sum); }
    }
    cout<<best<<"\\n";
    return 0;
}
`,
  java: `import java.util.*;
public class Main {
    public static void main(String[] args) throws Exception {
        Scanner sc=new Scanner(System.in);
        if(!sc.hasNextInt()) return;
        int n=sc.nextInt();
        long[] a=new long[n];
        for(int i=0;i<n;i++) a[i]=sc.nextLong();
        long best=a[0];
        for(int l=0;l<n;l++){ long sum=0; for(int r=l;r<n;r++){ sum+=a[r]; best=Math.max(best,sum);} }
        System.out.println(best);
    }
}
`,
};

type StressResult =
  | { type: "idle" }
  | { type: "running" }
  | { type: "success"; cases: number }
  | { type: "mismatch"; input: string; candidate: string; brute: string }
  | { type: "error"; message: string };

function loadStressBuffer(key: string, language: "cpp" | "java", fallback: string): string {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { lang?: string; code?: string };
    return parsed.lang === language && typeof parsed.code === "string" ? parsed.code : fallback;
  } catch {
    return fallback;
  }
}

function storeStressBuffer(key: string, language: "cpp" | "java", code: string): void {
  try {
    localStorage.setItem(key, JSON.stringify({ lang: language, code }));
  } catch {
    // ignore
  }
}

export default function Stress() {
  const t = useT();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblemId, setSelectedProblemId] = usePersistentState("airlock.stress.problem", "");
  const [language, setLanguage] = usePersistentState<"cpp" | "java">(
    "airlock.stress.lang",
    localStorage.getItem("airlock.defaultLang") === "java" ? "java" : "cpp"
  );
  // Buffers live inside Monaco (no per-keystroke re-renders). Mount seeds
  // come from the last session when the language matches, else templates.
  const [seeds] = useState(() => ({
    candidate: loadStressBuffer("airlock.stress.candidate", language, CANDIDATE_TEMPLATES[language]),
    brute: loadStressBuffer("airlock.stress.brute", language, BRUTE_TEMPLATES[language]),
    generator: loadStressBuffer("airlock.stress.generator", language, GEN_TEMPLATES[language]),
  }));
  const candidateRef = useRef<CodeEditorHandle>(null);
  const bruteRef = useRef<CodeEditorHandle>(null);
  const generatorRef = useRef<CodeEditorHandle>(null);
  const [maxCases, setMaxCases] = usePersistentState("airlock.stress.maxCases", 100);
  const [timeLimit, setTimeLimit] = usePersistentState("airlock.stress.timeLimit", 1000);
  const [result, setResult] = useState<StressResult>({ type: "idle" });

  useEffect(() => {
    api.listProblems().then(setProblems).catch(console.error);
  }, []);

  function snapshotBuffers() {
    const candidate = candidateRef.current?.getValue() ?? "";
    const brute = bruteRef.current?.getValue() ?? "";
    const generator = generatorRef.current?.getValue() ?? "";
    storeStressBuffer("airlock.stress.candidate", language, candidate);
    storeStressBuffer("airlock.stress.brute", language, brute);
    storeStressBuffer("airlock.stress.generator", language, generator);
    return { candidate, brute, generator };
  }

  function handleProblemPick(id: string) {
    setSelectedProblemId(id);
    const p = problems.find((x) => x.id === id);
    if (p?.brute_force_src) {
      bruteRef.current?.setValue(p.brute_force_src);
      if (p.brute_force_lang === "cpp" || p.brute_force_lang === "java") {
        setLanguage(p.brute_force_lang as "cpp" | "java");
      }
    }
  }

  function handleLanguageChange(lang: "cpp" | "java") {
    // Buffers are preserved: each editor stashes its own per-language draft
    // and restores it (or its template) when the shared language changes.
    setLanguage(lang);
  }

  async function handleRun() {
    const { candidate, brute, generator } = snapshotBuffers();
    if (!candidate.trim() || !brute.trim() || !generator.trim()) {
      setResult({ type: "error", message: t("stress.allThreeNeedCode") });
      return;
    }
    setResult({ type: "running" });
    try {
      const res = await api.runStressTest({
        language,
        candidateSrc: candidate,
        bruteForceSrc: brute,
        generatorSrc: generator,
        maxCases,
        timeLimitMs: timeLimit,
      });
      if (res === null) {
        setResult({ type: "success", cases: maxCases });
      } else {
        const [input, candOut, bruteOut] = res;
        setResult({ type: "mismatch", input, candidate: candOut, brute: bruteOut });
      }
    } catch (e) {
      setResult({ type: "error", message: String(e) });
    }
  }

  return (
    <div className="flex flex-col h-full bg-background animate-fade-in">
      {/* Workspace toolbar */}
      <div className="flex items-center gap-2 px-3 h-11 border-b border-border shrink-0 bg-background">
        <span className="text-[13px] font-medium truncate">{t("stress.title")}</span>
        <span className="text-xs text-muted-foreground truncate hidden lg:inline max-w-md">
          {t("stress.description")}
        </span>
        <Button
          onClick={handleRun}
          disabled={result.type === "running"}
          variant="success"
          size="md"
          className="ml-auto h-8 px-5 gap-1.5 shrink-0"
        >
          {result.type === "running" ? t("stress.running") : t("stress.run")}
        </Button>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap gap-3 px-3 py-2.5 border-b border-border shrink-0 items-end bg-background">
        <div className="flex flex-col gap-1 min-w-[200px] flex-1 sm:flex-none sm:w-56">
          <label className="text-xs font-medium text-muted-foreground">{t("stress.problemOptional")}</label>
          <Select value={selectedProblemId} onChange={(e) => handleProblemPick(e.target.value)}>
            <option value="">{t("stress.noProblem")}</option>
            {problems.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1 w-28">
          <label className="text-xs font-medium text-muted-foreground">{t("common.language")}</label>
          <Select value={language} onChange={(e) => handleLanguageChange(e.target.value as "cpp" | "java")}>
            <option value="cpp">C++17</option>
            <option value="java">Java</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1 w-24">
          <label className="text-xs font-medium text-muted-foreground">{t("stress.maxCases")}</label>
          <Input type="number" min={1} max={10000} value={String(maxCases)} onChange={(e) => setMaxCases(Number(e.target.value) || 100)} />
        </div>
        <div className="flex flex-col gap-1 w-24">
          <label className="text-xs font-medium text-muted-foreground">{t("stress.timeLimitMs")}</label>
          <Input type="number" min={100} max={10000} value={String(timeLimit)} onChange={(e) => setTimeLimit(Number(e.target.value) || 1000)} />
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 p-2 min-h-0 overflow-y-auto md:overflow-visible">
        <div className="flex flex-col min-h-[320px] md:min-h-0">
          <div className="flex items-center gap-2 px-1 h-10 shrink-0">
            <span className="text-[13px] font-medium">{t("stress.candidate")}</span>
            <Badge variant="outline">{t("stress.yourSolution")}</Badge>
          </div>
          <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden">
            <LazyCodeEditor ref={candidateRef} language={language} initialValue={seeds.candidate} editorKey="candidate" onLanguageChange={handleLanguageChange} showLanguageSelect={false} draftScope="stress-candidate" languageTemplates={CANDIDATE_TEMPLATES} onContentChange={(v) => storeStressBuffer("airlock.stress.candidate", language, v)} />
          </div>
        </div>
        <div className="flex flex-col min-h-[320px] md:min-h-0">
          <div className="flex items-center gap-2 px-1 h-10 shrink-0">
            <span className="text-[13px] font-medium">{t("stress.bruteForce")}</span>
            <Badge variant="outline">{t("stress.reference")}</Badge>
          </div>
          <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden">
            <LazyCodeEditor ref={bruteRef} language={language} initialValue={seeds.brute} editorKey="brute" onLanguageChange={handleLanguageChange} showLanguageSelect={false} draftScope="stress-brute" languageTemplates={BRUTE_TEMPLATES} onContentChange={(v) => storeStressBuffer("airlock.stress.brute", language, v)} />
          </div>
        </div>
        <div className="flex flex-col min-h-[320px] md:min-h-0">
          <div className="flex items-center gap-2 px-1 h-10 shrink-0">
            <span className="text-[13px] font-medium">{t("stress.generator")}</span>
            <Badge variant="outline">{t("stress.seedToCase")}</Badge>
          </div>
          <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden">
            <LazyCodeEditor ref={generatorRef} language={language} initialValue={seeds.generator} editorKey="generator" onLanguageChange={handleLanguageChange} showLanguageSelect={false} draftScope="stress-generator" languageTemplates={GEN_TEMPLATES} onContentChange={(v) => storeStressBuffer("airlock.stress.generator", language, v)} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shrink-0 mx-2 mb-2 max-h-[32%] flex flex-col transition-colors duration-150">
        <div className="flex items-center px-3 h-10 border-b border-border shrink-0">
          <span className="text-[13px] font-medium">{t("stress.title")}</span>
          {result.type === "running" && (
            <span className="ml-auto text-xs text-muted-foreground">{t("stress.mayTakeSeconds")}</span>
          )}
        </div>
        <div className="p-3 overflow-y-auto">
        {result.type === "idle" && (
          <div className="text-xs text-muted-foreground">{t("stress.idleHint")}</div>
        )}
        {result.type === "running" && (
          <div className="flex items-center gap-2 text-sm animate-fade-in">
            <span>{t("stress.fuzzing").replace("{count}", String(maxCases))}</span>
            <span className="text-xs text-muted-foreground">{t("stress.mayTakeSeconds")}</span>
          </div>
        )}
        {result.type === "success" && (
          <div className="flex items-center gap-3 animate-fade-in">
            <VerdictBadge verdict="Accepted" showLong size="lg" />
            <div className="text-sm">
              <div className="font-medium">{t("stress.noMismatches").replace("{count}", String(result.cases))}</div>
              <div className="text-xs text-muted-foreground">{t("stress.agreeHint")}</div>
            </div>
          </div>
        )}
        {result.type === "mismatch" && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <VerdictBadge verdict="WrongAnswer" showLong size="lg" />
              <div className="text-sm font-medium">{t("stress.foundCounter")}</div>
            </div>
            <div className="grid md:grid-cols-3 gap-2">
              <Card className="p-3 transition-colors duration-150">
                <div className="text-xs font-medium text-muted-foreground mb-1.5">{t("stress.failingInput")}</div>
                <pre className="bg-black/40 rounded-lg p-2 text-xs whitespace-pre-wrap border border-border font-mono break-words">
                  {result.input}
                </pre>
              </Card>
              <Card className="p-3 transition-colors duration-150">
                <div className="text-xs font-medium text-muted-foreground mb-1.5">{t("stress.candidateOutput")}</div>
                <pre className="bg-wa/[0.04] border-wa/20 rounded-lg p-2 text-xs whitespace-pre-wrap border font-mono break-words">
                  {result.candidate || t("common.empty")}
                </pre>
              </Card>
              <Card className="p-3 transition-colors duration-150">
                <div className="text-xs font-medium text-muted-foreground mb-1.5">{t("stress.bruteOutput")}</div>
                <pre className="bg-ac/[0.04] border-ac/20 rounded-lg p-2 text-xs whitespace-pre-wrap border font-mono break-words">
                  {result.brute || t("common.empty")}
                </pre>
              </Card>
            </div>
            <div className="text-xs text-muted-foreground">{t("stress.copyHint")}</div>
          </div>
        )}
        {result.type === "error" && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center gap-2">
              <VerdictBadge verdict="CompileError" showLong />
              <span className="text-sm font-medium">{t("stress.compileFailed")}</span>
            </div>
            <pre className="bg-black/40 border border-border rounded-lg p-3 text-xs whitespace-pre-wrap break-words font-mono max-h-48 overflow-auto">
              {result.message}
            </pre>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
