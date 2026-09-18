import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Problem } from "../lib/types";
import CodeEditor from "../components/CodeEditor";
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

export default function Stress() {
  const t = useT();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState<string>("");
  const [language, setLanguage] = useState<"cpp" | "java">("cpp");
  const [candidate, setCandidate] = useState(CANDIDATE_TEMPLATES["cpp"]);
  const [brute, setBrute] = useState(BRUTE_TEMPLATES["cpp"]);
  const [generator, setGenerator] = useState(GEN_TEMPLATES["cpp"]);
  const [maxCases, setMaxCases] = useState(100);
  const [timeLimit, setTimeLimit] = useState(1000);
  const [result, setResult] = useState<StressResult>({ type: "idle" });

  useEffect(() => {
    api.listProblems().then(setProblems).catch(console.error);
  }, []);

  function handleProblemPick(id: string) {
    setSelectedProblemId(id);
    const p = problems.find((x) => x.id === id);
    if (p?.brute_force_src) {
      setBrute(p.brute_force_src);
      if (p.brute_force_lang === "cpp" || p.brute_force_lang === "java") {
        setLanguage(p.brute_force_lang as "cpp" | "java");
      }
    }
  }

  function handleLanguageChange(lang: "cpp" | "java") {
    setLanguage(lang);
    setCandidate(CANDIDATE_TEMPLATES[lang]);
    setBrute(BRUTE_TEMPLATES[lang]);
    setGenerator(GEN_TEMPLATES[lang]);
  }

  async function handleRun() {
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
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm p-4">
        <h1 className="text-sm font-semibold">{t("stress.title")}</h1>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {t("stress.description")}
        </p>
        <div className="flex flex-wrap gap-3 mt-3 items-end">
          <div className="flex flex-col gap-1 min-w-[220px]">
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
          <div className="flex flex-col gap-1 w-28">
            <label className="text-xs font-medium text-muted-foreground">{t("stress.maxCases")}</label>
            <Input type="number" min={1} max={10000} value={String(maxCases)} onChange={(e) => setMaxCases(Number(e.target.value) || 100)} />
          </div>
          <div className="flex flex-col gap-1 w-28">
            <label className="text-xs font-medium text-muted-foreground">{t("stress.timeLimitMs")}</label>
            <Input type="number" min={100} max={10000} value={String(timeLimit)} onChange={(e) => setTimeLimit(Number(e.target.value) || 1000)} />
          </div>
          <Button onClick={handleRun} disabled={result.type === "running"} size="md" className="ml-auto">
            {result.type === "running" ? t("stress.running") : t("stress.run")}
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-3 p-3 min-h-0">
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{t("stress.candidate")}</span>
            <Badge variant="outline">{t("stress.yourSolution")}</Badge>
          </div>
          <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border">
            <CodeEditor language={language} value={candidate} onChange={setCandidate} onLanguageChange={handleLanguageChange} />
          </div>
        </div>
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{t("stress.bruteForce")}</span>
            <Badge variant="outline">{t("stress.reference")}</Badge>
          </div>
          <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border">
            <CodeEditor language={language} value={brute} onChange={setBrute} onLanguageChange={handleLanguageChange} />
          </div>
        </div>
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{t("stress.generator")}</span>
            <Badge variant="outline">{t("stress.seedToCase")}</Badge>
          </div>
          <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border">
            <CodeEditor language={language} value={generator} onChange={setGenerator} onLanguageChange={handleLanguageChange} />
          </div>
        </div>
      </div>

      <div className="border-t border-border p-3 bg-card/30 max-h-[32%] overflow-y-auto">
        {result.type === "idle" && (
          <div className="text-xs text-muted-foreground">{t("stress.idleHint")}</div>
        )}
        {result.type === "running" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="animate-pulse">{t("stress.fuzzing").replace("{count}", String(maxCases))}</span>
            <span className="text-xs text-muted-foreground">{t("stress.mayTakeSeconds")}</span>
          </div>
        )}
        {result.type === "success" && (
          <div className="flex items-center gap-3">
            <VerdictBadge verdict="Accepted" showLong size="lg" />
            <div className="text-sm">
              <div className="font-medium">{t("stress.noMismatches").replace("{count}", String(result.cases))}</div>
              <div className="text-xs text-muted-foreground">{t("stress.agreeHint")}</div>
            </div>
          </div>
        )}
        {result.type === "mismatch" && (
          <div className="space-y-3 animate-slide-up">
            <div className="flex items-center gap-3">
              <VerdictBadge verdict="WrongAnswer" showLong size="lg" />
              <div className="text-sm font-medium">{t("stress.foundCounter")}</div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Card className="p-3">
                <div className="text-xs font-semibold mb-1">{t("stress.failingInput")}</div>
                <pre className="bg-black/40 rounded-md p-2 text-xs whitespace-pre-wrap border border-border font-mono break-words">
                  {result.input}
                </pre>
              </Card>
              <Card className="p-3">
                <div className="text-xs font-semibold mb-1">{t("stress.candidateOutput")}</div>
                <pre className="bg-wa/10 border-wa/30 rounded-md p-2 text-xs whitespace-pre-wrap border font-mono break-words">
                  {result.candidate || t("common.empty")}
                </pre>
              </Card>
              <Card className="p-3">
                <div className="text-xs font-semibold mb-1">{t("stress.bruteOutput")}</div>
                <pre className="bg-ac/10 border-ac/30 rounded-md p-2 text-xs whitespace-pre-wrap border font-mono break-words">
                  {result.brute || t("common.empty")}
                </pre>
              </Card>
            </div>
            <div className="text-xs text-muted-foreground">{t("stress.copyHint")}</div>
          </div>
        )}
        {result.type === "error" && (
          <div className="space-y-2">
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
  );
}
