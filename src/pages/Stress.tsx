import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Problem } from "../lib/types";
import CodeEditor from "../components/CodeEditor";
import VerdictBadge from "../components/VerdictBadge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

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
    if (!candidate.trim() || candidate === CANDIDATE_TEMPLATES[language]) setCandidate(CANDIDATE_TEMPLATES[lang]);
    if (!brute.trim() || brute === BRUTE_TEMPLATES[language]) setBrute(BRUTE_TEMPLATES[lang]);
    if (!generator.trim() || generator === GEN_TEMPLATES[language]) setGenerator(GEN_TEMPLATES[lang]);
  }

  async function handleRun() {
    if (!candidate.trim() || !brute.trim() || !generator.trim()) {
      setResult({ type: "error", message: "All three editors need code." });
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
        <h1 className="text-sm font-semibold">Stress test lab</h1>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Fuzz your solution against a brute force. Generator takes <span className="font-mono text-foreground">seed</span> from{" "}
          <span className="font-mono text-foreground">argv[1]</span> and prints one test case. Candidate and brute read from
          stdin.
        </p>
        <div className="flex flex-wrap gap-3 mt-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Problem (optional)</label>
            <select
              className="bg-card border border-border rounded-md h-8 px-2 text-sm min-w-[220px]"
              value={selectedProblemId}
              onChange={(e) => handleProblemPick(e.target.value)}
            >
              <option value="">No problem — free form</option>
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Language</label>
            <select
              className="bg-card border border-border rounded-md h-8 px-2 text-sm"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as "cpp" | "java")}
            >
              <option value="cpp">C++17</option>
              <option value="java">Java</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Max cases</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={maxCases}
              onChange={(e) => setMaxCases(Number(e.target.value) || 100)}
              className="bg-card border border-border rounded-md h-8 px-2 text-sm w-28"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Time limit ms</label>
            <input
              type="number"
              min={100}
              max={10000}
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value) || 1000)}
              className="bg-card border border-border rounded-md h-8 px-2 text-sm w-28"
            />
          </div>
          <Button onClick={handleRun} disabled={result.type === "running"} size="md" className="ml-auto">
            {result.type === "running" ? "Running..." : "Run stress test"}
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-3 p-3 min-h-0">
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">Candidate</span>
            <Badge variant="outline">your solution</Badge>
          </div>
          <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border">
            <CodeEditor language={language} value={candidate} onChange={setCandidate} onLanguageChange={handleLanguageChange} />
          </div>
        </div>
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">Brute force</span>
            <Badge variant="outline">reference</Badge>
          </div>
          <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border">
            <CodeEditor language={language} value={brute} onChange={setBrute} onLanguageChange={handleLanguageChange} />
          </div>
        </div>
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">Generator</span>
            <Badge variant="outline">seed → test case</Badge>
          </div>
          <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border">
            <CodeEditor language={language} value={generator} onChange={setGenerator} onLanguageChange={handleLanguageChange} />
          </div>
        </div>
      </div>

      <div className="border-t border-border p-3 bg-card/30 max-h-[32%] overflow-y-auto">
        {result.type === "idle" && (
          <div className="text-xs text-muted-foreground">Fill the three editors and click Run. Start with the templates.</div>
        )}
        {result.type === "running" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="animate-pulse">Fuzzing {maxCases} cases...</span>
            <span className="text-xs text-muted-foreground">This may take a few seconds</span>
          </div>
        )}
        {result.type === "success" && (
          <div className="flex items-center gap-3">
            <VerdictBadge verdict="Accepted" showLong size="lg" />
            <div className="text-sm">
              <div className="font-medium">No mismatches in {result.cases} cases</div>
              <div className="text-xs text-muted-foreground">Generator and both solutions agree. Try more cases or a different generator.</div>
            </div>
          </div>
        )}
        {result.type === "mismatch" && (
          <div className="space-y-3 animate-slide-up">
            <div className="flex items-center gap-3">
              <VerdictBadge verdict="WrongAnswer" showLong size="lg" />
              <div className="text-sm font-medium">Found a counter example</div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Card className="p-3">
                <div className="text-xs font-semibold mb-1">Failing input</div>
                <pre className="bg-black/40 rounded-md p-2 text-xs whitespace-pre-wrap border border-border font-mono break-words">
                  {result.input}
                </pre>
              </Card>
              <Card className="p-3">
                <div className="text-xs font-semibold mb-1">Candidate output</div>
                <pre className="bg-wa/10 border-wa/30 rounded-md p-2 text-xs whitespace-pre-wrap border font-mono break-words">
                  {result.candidate || "(empty)"}
                </pre>
              </Card>
              <Card className="p-3">
                <div className="text-xs font-semibold mb-1">Brute output</div>
                <pre className="bg-ac/10 border-ac/30 rounded-md p-2 text-xs whitespace-pre-wrap border font-mono break-words">
                  {result.brute || "(empty)"}
                </pre>
              </Card>
            </div>
            <div className="text-xs text-muted-foreground">Copy the input and run both solutions locally to debug. Check whitespace handling.</div>
          </div>
        )}
        {result.type === "error" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <VerdictBadge verdict="CompileError" showLong />
              <span className="text-sm font-medium">Stress test failed to compile or run</span>
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
