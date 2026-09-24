import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Problem, Technique } from "../lib/types";
import { MAX_HINTS } from "../components/HintLadder";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select } from "../components/ui/select";
import { PanelTabs } from "../components/PanelTabs";
import VerdictBadge from "../components/VerdictBadge";
import { useT } from "../lib/i18n";

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
    { id: "", input: "1000000000 1000000000\n", expected_output: "2000000000\n" },
  ],
  brute_force_src: null,
  brute_force_lang: null,
  hints: [],
};

type TestDraft = { input: string; expected_output: string };

function validateProblem(
  draft: {
    title: string;
    statement: string;
    tags: string;
    difficulty: string;
    timeLimit: string;
    memoryLimit: string;
    source: string;
    tests: TestDraft[];
  },
  t: (k: string) => string
): string | null {
  if (!draft.title.trim()) return t("import.errTitle");
  if (!draft.statement.trim()) return t("import.errStatement");
  if (draft.tests.length === 0) return t("import.errAddTest");
  for (let i = 0; i < draft.tests.length; i++) {
    const tt = draft.tests[i];
    if (!tt.input && !tt.expected_output) return t("import.errTestEmpty").replace("{num}", String(i + 1));
  }
  const diff = Number(draft.difficulty);
  if (isNaN(diff) || diff < 0 || diff > 5000) return t("import.errDifficulty");
  const tl = Number(draft.timeLimit);
  if (isNaN(tl) || tl <= 0) return t("import.errTime");
  const ml = Number(draft.memoryLimit);
  if (isNaN(ml) || ml <= 0) return t("import.errMemory");
  return null;
}

type PackManifest = { pack_name?: string; techniques?: { id?: string; name?: string }[]; problem_files?: string[] };

function normalizePackProblem(parsed: unknown): Problem {
  const p = parsed as Record<string, unknown>;
  const tests = p.tests;
  if (!Array.isArray(tests) || tests.length === 0) throw new Error("problem has no tests");
  return {
    id: typeof p.id === "string" ? p.id : "",
    title: typeof p.title === "string" ? p.title : "",
    statement_md: typeof p.statement_md === "string" ? p.statement_md : typeof p.statement === "string" ? p.statement : "",
    tags: Array.isArray(p.tags) ? (p.tags as unknown[]).map(String) : [],
    difficulty: Number(p.difficulty) || 0,
    time_limit_ms: Number(p.time_limit_ms) || 1000,
    memory_limit_mb: Number(p.memory_limit_mb) || 256,
    source: typeof p.source === "string" && p.source ? p.source : "imported",
    tests: (tests as unknown[]).map((x) => {
      const tt = x as Record<string, unknown>;
      return {
        id: typeof tt.id === "string" ? tt.id : "",
        input: typeof tt.input === "string" ? tt.input : "",
        expected_output: typeof tt.expected_output === "string" ? tt.expected_output : "",
      };
    }),
    brute_force_src: typeof p.brute_force_src === "string" ? p.brute_force_src : null,
    brute_force_lang: typeof p.brute_force_lang === "string" ? p.brute_force_lang : null,
    primary_technique_id: typeof p.primary_technique_id === "string" ? p.primary_technique_id : null,
    hints: Array.isArray(p.hints)
      ? (p.hints as unknown[]).map((h) => String(h ?? "").trim()).filter(Boolean).slice(0, MAX_HINTS)
      : [],
  };
}

export default function Import() {
  const t = useT();
  const [mode, setMode] = useState<"form" | "json" | "pack">("form");
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
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [primaryTechniqueId, setPrimaryTechniqueId] = useState("");
  const [hints, setHints] = useState<string[]>([]);

  useEffect(() => {
    api.listTechniques().then(setTechniques).catch(() => setTechniques([]));
  }, []);

  const [jsonText, setJsonText] = useState(JSON.stringify(SAMPLE, null, 2));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [manifest, setManifest] = useState<PackManifest | null>(null);
  const [packFiles, setPackFiles] = useState<{ name: string; json: unknown }[]>([]);

  async function handleManifestFile(f: File | undefined) {
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()) as PackManifest;
      if (!Array.isArray(parsed.problem_files)) throw new Error("bad manifest");
      setManifest(parsed);
      setResult(null);
    } catch {
      setManifest(null);
      setResult({ ok: false, msg: t("import.packBadManifest") });
    }
  }

  async function handleProblemFiles(files: FileList | null) {
    if (!files) return;
    const loaded: { name: string; json: unknown }[] = [];
    for (const f of Array.from(files)) {
      try {
        loaded.push({ name: f.name, json: JSON.parse(await f.text()) });
      } catch {
        setResult({ ok: false, msg: t("import.packBadFile").replace("{name}", f.name) });
        return;
      }
    }
    setPackFiles(loaded);
    setResult(null);
  }

  async function handlePackImport() {
    if (!manifest) {
      setResult({ ok: false, msg: t("import.packNeedManifest") });
      return;
    }
    const byName = new Map(packFiles.map((f) => [f.name, f.json]));
    const missing = (manifest.problem_files ?? []).filter((n) => !byName.has(n));
    if (missing.length > 0) {
      setResult({ ok: false, msg: t("import.packMissing").replace("{names}", missing.join(", ")) });
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const problems = (manifest.problem_files ?? []).map((n) => normalizePackProblem(byName.get(n)));
      const techniques = (manifest.techniques ?? [])
        .filter((x) => x && typeof x.id === "string" && typeof x.name === "string")
        .map((x) => ({ id: x.id as string, name: x.name as string }));
      const summary = await api.importPack({ techniques, problems });
      setResult({
        ok: true,
        msg: t("import.packImported")
          .replace("{problems}", String(summary.problems_imported))
          .replace("{new}", String(summary.techniques_inserted))
          .replace("{kept}", String(summary.techniques_kept)),
      });
      setManifest(null);
      setPackFiles([]);
    } catch (e) {
      setResult({ ok: false, msg: String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleFormSave() {
    const err = validateProblem({ title, statement, tags, difficulty, timeLimit, memoryLimit, source, tests }, t);
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
          .map((tg) => tg.trim())
          .filter(Boolean),
        difficulty: Number(difficulty),
        time_limit_ms: Number(timeLimit),
        memory_limit_mb: Number(memoryLimit),
        source: source.trim() || "self-authored",
        tests: tests.map((tt) => ({ id: "", input: tt.input, expected_output: tt.expected_output })),
        brute_force_src: bruteSrc.trim() || null,
        brute_force_lang: bruteSrc.trim() ? bruteLang : null,
        primary_technique_id: primaryTechniqueId || null,
        hints: hints.map((h) => h.trim()).filter(Boolean).slice(0, MAX_HINTS),
      };
      const saved = await api.saveProblem(problem);
      setResult({ ok: true, msg: t("import.savedWithTests").replace("{title}", saved.title).replace("{count}", String(saved.tests.length)) });
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
      if (!parsed.title) throw new Error(t("import.missingTitle"));
      if (!Array.isArray(parsed.tests) || parsed.tests.length === 0) throw new Error(t("import.testsNonEmpty"));
      const problem: Problem = {
        id: parsed.id || "",
        title: parsed.title,
        statement_md: parsed.statement_md || parsed.statement || "",
        tags: parsed.tags || [],
        difficulty: Number(parsed.difficulty) || 0,
        time_limit_ms: Number(parsed.time_limit_ms) || 1000,
        memory_limit_mb: Number(parsed.memory_limit_mb) || 256,
        source: parsed.source || "imported",
        tests: parsed.tests.map((tt: TestDraft & { id?: string }) => ({
          id: tt.id || "",
          input: tt.input ?? "",
          expected_output: tt.expected_output ?? "",
        })),
        brute_force_src: parsed.brute_force_src || null,
        brute_force_lang: parsed.brute_force_lang || null,
        primary_technique_id: parsed.primary_technique_id || null,
        hints: Array.isArray(parsed.hints)
          ? parsed.hints.map((h: unknown) => String(h ?? "").trim()).filter(Boolean).slice(0, MAX_HINTS)
          : [],
      };
      const saved = await api.saveProblem(problem);
      setResult({ ok: true, msg: t("import.importedCheck").replace("{title}", saved.title).replace("{id}", saved.id.slice(0, 8)) });
    } catch (e) {
      setResult({ ok: false, msg: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 animate-fade-in">
      <h1 className="text-xl font-semibold">{t("import.title")}</h1>
      <p className="text-sm text-muted-foreground mt-1">
        {t("import.subtitle")}
      </p>

      <div className="mt-4 mb-4 flex items-center gap-2">
        <Badge variant="outline">{t("import.localVault")}</Badge>
        <span className="text-xs text-muted-foreground">{t("import.savedToSqlite")}</span>
      </div>

      <Card className="overflow-hidden transition-colors duration-150">
        <PanelTabs
          active={mode}
          onChange={(id) => setMode(id as "form" | "json" | "pack")}
          tabs={[
            { id: "form", label: t("import.form") },
            { id: "json", label: t("import.jsonPaste") },
            { id: "pack", label: t("import.pack") },
          ]}
        />
        {mode === "form" ? (
        <div className="p-5 space-y-3">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t("import.titleLabel")}</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A+B" />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t("import.statementLabel")}</label>
            <Textarea className="min-h-[140px] font-sans" value={statement} onChange={(e) => setStatement(e.target.value)} placeholder={t("import.statementPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t("import.tagsLabel")}</label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t("import.tagsPlaceholder")} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t("import.sourceLabel")}</label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="self-authored" />
            </div>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t("import.techniqueLabel")}</label>
            <Select value={primaryTechniqueId} onChange={(e) => setPrimaryTechniqueId(e.target.value)}>
              <option value="">{t("import.noTechnique")}</option>
              {techniques.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">{t("import.hintsLabel")}</label>
              {hints.length < MAX_HINTS && (
                <Button variant="secondary" size="sm" onClick={() => setHints([...hints, ""])}>
                  {t("import.addHint")}
                </Button>
              )}
            </div>
            {hints.map((h, i) => (
              <div key={i} className="flex gap-2 items-start">
                <Textarea
                  className="min-h-[56px] font-sans text-xs"
                  value={h}
                  onChange={(e) => setHints(hints.map((x, idx) => (idx === i ? e.target.value : x)))}
                  placeholder={t("import.hintPlaceholder").replace("{n}", String(i + 1))}
                />
                <Button variant="ghost" size="sm" onClick={() => setHints(hints.filter((_, idx) => idx !== i))}>
                  {t("common.remove")}
                </Button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t("import.difficultyLabel")}</label>
              <Input type="number" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t("import.timeLabel")}</label>
              <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t("import.memoryLabel")}</label>
              <Input type="number" value={memoryLimit} onChange={(e) => setMemoryLimit(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">{t("import.tests")}</label>
              <Button variant="secondary" size="sm" onClick={() => setTests([...tests, { input: "", expected_output: "" }])}>
                {t("import.addTest")}
              </Button>
            </div>
            {tests.map((tt, i) => (
              <Card key={i} className="p-3 bg-background border-border rounded-lg transition-colors duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{t("practice.test")} {i + 1}</span>
                  <Button variant="ghost" size="sm" onClick={() => setTests(tests.filter((_, idx) => idx !== i))}>
                    {t("common.remove")}
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">{t("common.input")}</label>
                    <Textarea className="min-h-[80px] font-mono text-xs" value={tt.input} onChange={(e) => setTests(tests.map((x, idx) => (idx === i ? { ...x, input: e.target.value } : x)))} />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">{t("common.expectedOutput")}</label>
                    <Textarea className="min-h-[80px] font-mono text-xs" value={tt.expected_output} onChange={(e) => setTests(tests.map((x, idx) => (idx === i ? { ...x, expected_output: e.target.value } : x)))} />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t("import.bruteOptional")}</label>
            <div className="flex gap-2 mb-1">
              <div className="w-28">
                <Select value={bruteLang} onChange={(e) => setBruteLang(e.target.value as "cpp" | "java")} className="h-8 text-xs">
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                </Select>
              </div>
              <span className="text-xs text-muted-foreground self-center">{t("import.usedByStress")}</span>
            </div>
            <Textarea className="min-h-[120px] font-mono text-xs" value={bruteSrc} onChange={(e) => setBruteSrc(e.target.value)} placeholder={t("import.brutePlaceholder")} />
          </div>

          <Button onClick={handleFormSave} disabled={saving} className="w-full">
            {saving ? t("import.saving") : t("import.saveProblem")}
          </Button>
        </div>
      ) : mode === "json" ? (
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">{t("common.json")}</span>
            <Button variant="ghost" size="sm" onClick={() => setJsonText(JSON.stringify(SAMPLE, null, 2))}>
              {t("import.loadSample")}
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
              {t("import.download")}
            </Button>
            <label className="ml-auto text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors duration-150">
              {t("import.loadFile")}
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
            {saving ? t("import.importing") : t("import.importJson")}
          </Button>
        </div>
      ) : (
        <div className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{t("import.packDesc")}</p>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t("import.manifest")}</label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-2 text-sm cursor-pointer hover:bg-white/[0.03] transition-colors">
              <span className="flex-1 truncate text-muted-foreground">
                {manifest
                  ? `${manifest.pack_name ?? "pack.json"} · ${(manifest.problem_files ?? []).length} ${t("import.packFilesCount")}`
                  : t("import.chooseManifest")}
              </span>
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  void handleManifestFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t("import.problemFiles")}</label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-2 text-sm cursor-pointer hover:bg-white/[0.03] transition-colors">
              <span className="flex-1 truncate text-muted-foreground">
                {packFiles.length > 0
                  ? t("import.chosenCount").replace("{count}", String(packFiles.length))
                  : t("import.chooseProblems")}
              </span>
              <input
                type="file"
                accept="application/json"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleProblemFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <Button onClick={handlePackImport} disabled={saving} className="w-full">
            {saving ? t("import.importing") : t("import.importPackBtn")}
          </Button>
        </div>
      )}
      </Card>

      {result && (
        <Card className={`p-4 mt-4 flex items-start gap-3 rounded-lg border-border bg-card transition-colors duration-150 animate-fade-in ${result.ok ? "border-ac/30" : "border-wa/30"}`}>
          {result.ok ? <VerdictBadge verdict="Accepted" /> : <VerdictBadge verdict="CompileError" />}
          <div className="text-sm">
            <div className={`font-medium ${result.ok ? "text-ac" : "text-wa"}`}>{result.ok ? t("common.saved") : t("common.failed")}</div>
            <div className="text-xs text-muted-foreground mt-1 break-words">{result.msg}</div>
          </div>
        </Card>
      )}
    </div>
  );
}
