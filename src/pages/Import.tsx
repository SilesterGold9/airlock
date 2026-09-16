import { useState } from "react";
import { api } from "../lib/api";
import type { Problem } from "../lib/types";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select } from "../components/ui/select";
import VerdictBadge from "../components/VerdictBadge";

const SAMPLE: Problem = {
  id: "",
  title: "A+B (sanity check)",
  statement_md: "Given two integers A and B on a single line, print their sum.\n\n**Input**\nOne line: `A B` (-10^9 <= A, B <= 10^9)\n\n**Output**\nA single integer: A + B.",
  tags: ["implementation", "warmup"],
  difficulty: 800,
  time_limit_ms: 1000,
  memory_limit_mb: 256,
  source: "self-authored",
  tests: [
    { id: "", input: "2 3\n", expected_output: "5\n" },
    { id: "", input: "-5 10\n", expected_output: "5\n" },
  ],
  brute_force_src: null,
  brute_force_lang: null,
};

type TestDraft = { input: string; expected_output: string };

function validateProblem(draft: {
  title: string;
  statement: string;
  tags: string;
  difficulty: string;
  timeLimit: string;
  memoryLimit: string;
  source: string;
  tests: TestDraft[];
}): string | null {
  if (!draft.title.trim()) return "Title is required.";
  if (!draft.statement.trim()) return "Statement is required.";
  if (draft.tests.length === 0) return "Add at least one test.";
  for (let i = 0; i < draft.tests.length; i++) {
    const t = draft.tests[i];
    if (!t.input && !t.expected_output) return `Test ${i + 1} is empty.`;
  }
  const diff = Number(draft.difficulty);
  if (isNaN(diff) || diff < 0 || diff > 5000) return "Difficulty should be 0 to 5000.";
  const tl = Number(draft.timeLimit);
  if (isNaN(tl) || tl <= 0) return "Time limit must be positive.";
  const ml = Number(draft.memoryLimit);
  if (isNaN(ml) || ml <= 0) return "Memory limit must be positive.";
  return null;
}

export default function Import() {
  const [mode, setMode] = useState<"form" | "json">("form");
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [tags, setTags] = useState("");
  const [difficulty, setDifficulty] = useState("800");
  const [timeLimit, setTimeLimit] = useState("1000");
  const [memoryLimit, setMemoryLimit] = useState("256");
  const [source, setSource] = useState("self-authored");
  const [tests, setTests] = useState<TestDraft[]>([{ input: "2 3\n", expected_output: "5\n" }]);
  const [bruteSrc, setBruteSrc] = useState("");
  const [bruteLang, setBruteLang] = useState<"cpp" | "java">("cpp");

  const [jsonText, setJsonText] = useState(JSON.stringify(SAMPLE, null, 2));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleFormSave() {
    const err = validateProblem({ title, statement, tags, difficulty, timeLimit, memoryLimit, source, tests });
    if (err) {
      setResult({ ok: false, msg: err });
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const problem: Problem = {
        id: "",
        title: title.trim(),
        statement_md: statement,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        difficulty: Number(difficulty),
        time_limit_ms: Number(timeLimit),
        memory_limit_mb: Number(memoryLimit),
        source: source.trim() || "self-authored",
        tests: tests.map((t) => ({ id: "", input: t.input, expected_output: t.expected_output })),
        brute_force_src: bruteSrc.trim() || null,
        brute_force_lang: bruteSrc.trim() ? bruteLang : null,
      };
      const saved = await api.saveProblem(problem);
      setResult({ ok: true, msg: `Saved "${saved.title}" with ${saved.tests.length} tests. It now appears in Practice.` });
    } catch (e) {
      setResult({ ok: false, msg: String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleJsonSave() {
    setSaving(true);
    setResult(null);
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.title) throw new Error("Missing title.");
      if (!Array.isArray(parsed.tests) || parsed.tests.length === 0) throw new Error("tests must be a non empty array.");
      const problem: Problem = {
        id: parsed.id || "",
        title: parsed.title,
        statement_md: parsed.statement_md || parsed.statement || "",
        tags: parsed.tags || [],
        difficulty: Number(parsed.difficulty) || 0,
        time_limit_ms: Number(parsed.time_limit_ms) || 1000,
        memory_limit_mb: Number(parsed.memory_limit_mb) || 256,
        source: parsed.source || "imported",
        tests: parsed.tests.map((t: TestDraft & { id?: string }) => ({
          id: t.id || "",
          input: t.input ?? "",
          expected_output: t.expected_output ?? "",
        })),
        brute_force_src: parsed.brute_force_src || null,
        brute_force_lang: parsed.brute_force_lang || null,
      };
      const saved = await api.saveProblem(problem);
      setResult({ ok: true, msg: `Imported "${saved.title}" (${saved.id.slice(0, 8)}). Check Practice.` });
    } catch (e) {
      setResult({ ok: false, msg: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 animate-fade-in">
      <h1 className="text-xl font-semibold">Import problems</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Add curated problems while you have internet. Paste the JSON shape from <span className="font-mono">Problem</span> or use the form.
        Use <span className="font-mono">sample-problems/*.json</span> as template.
      </p>

      <div className="flex gap-2 mt-4 mb-6">
        <Button variant={mode === "form" ? "primary" : "secondary"} size="sm" onClick={() => setMode("form")}>
          Form
        </Button>
        <Button variant={mode === "json" ? "primary" : "secondary"} size="sm" onClick={() => setMode("json")}>
          JSON paste
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline">local vault</Badge>
          <span className="text-xs text-muted-foreground">saved to SQLite</span>
        </div>
      </div>

      {mode === "form" ? (
        <Card className="p-6 space-y-4">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A+B" />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Statement markdown</label>
            <Textarea className="min-h-[140px] font-sans" value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Describe the problem..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Tags comma separated</label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="implementation, warmup" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Source</label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="self-authored" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Difficulty 0 to 5000</label>
              <Input type="number" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Time limit ms</label>
              <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Memory MB</label>
              <Input type="number" value={memoryLimit} onChange={(e) => setMemoryLimit(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Tests</label>
              <Button variant="secondary" size="sm" onClick={() => setTests([...tests, { input: "", expected_output: "" }])}>
                Add test
              </Button>
            </div>
            {tests.map((t, i) => (
              <Card key={i} className="p-3 bg-background">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">Test {i + 1}</span>
                  <Button variant="ghost" size="sm" onClick={() => setTests(tests.filter((_, idx) => idx !== i))}>
                    Remove
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Input</label>
                    <Textarea className="min-h-[80px] font-mono text-xs" value={t.input} onChange={(e) => setTests(tests.map((x, idx) => (idx === i ? { ...x, input: e.target.value } : x)))} />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Expected output</label>
                    <Textarea className="min-h-[80px] font-mono text-xs" value={t.expected_output} onChange={(e) => setTests(tests.map((x, idx) => (idx === i ? { ...x, expected_output: e.target.value } : x)))} />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Brute force src optional</label>
            <div className="flex gap-2 mb-1">
              <div className="w-28">
                <Select value={bruteLang} onChange={(e) => setBruteLang(e.target.value as "cpp" | "java")} className="h-8 text-xs">
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                </Select>
              </div>
              <span className="text-xs text-muted-foreground self-center">used by stress lab</span>
            </div>
            <Textarea className="min-h-[120px] font-mono text-xs" value={bruteSrc} onChange={(e) => setBruteSrc(e.target.value)} placeholder="Optional brute force solution" />
          </div>

          <Button onClick={handleFormSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save problem"}
          </Button>
        </Card>
      ) : (
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">JSON</span>
            <Button variant="ghost" size="sm" onClick={() => setJsonText(JSON.stringify(SAMPLE, null, 2))}>
              Load sample
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const blob = new Blob([jsonText], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "problem.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download
            </Button>
            <label className="ml-auto text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              Load file
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  f.text().then(setJsonText);
                }}
              />
            </label>
          </div>
          <Textarea className="min-h-[360px] font-mono text-xs" value={jsonText} onChange={(e) => setJsonText(e.target.value)} />
          <Button onClick={handleJsonSave} disabled={saving} className="w-full">
            {saving ? "Importing..." : "Import JSON"}
          </Button>
        </Card>
      )}

      {result && (
        <Card className={`p-4 mt-4 flex items-start gap-3 ${result.ok ? "border-ac/30 bg-ac/10" : "border-wa/30 bg-wa/10"}`}>
          {result.ok ? <VerdictBadge verdict="Accepted" /> : <VerdictBadge verdict="CompileError" />}
          <div className="text-sm">
            <div className={`font-medium ${result.ok ? "text-ac" : "text-wa"}`}>{result.ok ? "Saved" : "Failed"}</div>
            <div className="text-xs text-muted-foreground mt-1 break-words">{result.msg}</div>
          </div>
        </Card>
      )}
    </div>
  );
}
