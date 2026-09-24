import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { templateFor } from "../lib/templates";
import type { Technique } from "../lib/types";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Select } from "../components/ui/select";
import CodeEditor from "../components/CodeEditor";
import { useT } from "../lib/i18n";

type Phase = "setup" | "session" | "report";
type Outcome = "reconstructed" | "partial" | "blocked";

const DURATIONS = [5, 10, 15];

function formatClock(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function Recall() {
  const t = useT();
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [techniqueId, setTechniqueId] = useState("");
  const [language, setLanguage] = useState<"cpp" | "java">(() =>
    localStorage.getItem("airlock.defaultLang") === "java" ? "java" : "cpp"
  );
  const [minutes, setMinutes] = useState(10);
  const [phase, setPhase] = useState<Phase>("setup");
  const [remaining, setRemaining] = useState(0);
  const [code, setCode] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [assimilated, setAssimilated] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .listTechniques()
      .then((all) => {
        setTechniques(all);
        const preferred = all.find((x) => x.status === "Rusty") || all.find((x) => x.status === "Learning") || all[0];
        if (preferred) setTechniqueId(preferred.id);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (phase !== "session") return;
    if (remaining <= 0) {
      setPhase("report");
      return;
    }
    const id = setTimeout(() => setRemaining((v) => v - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, remaining]);

  const selected = techniques.find((x) => x.id === techniqueId) || null;

  function handleStart() {
    if (!selected) return;
    setCode(templateFor(language, "standard"));
    setOutcome(null);
    setAssimilated(false);
    setRemaining(minutes * 60);
    setPhase("session");
  }

  async function refresh() {
    try {
      const all = await api.listTechniques();
      setTechniques(all);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleOutcome(o: Outcome) {
    if (!selected || outcome) return;
    setOutcome(o);
    setBusy(true);
    try {
      await api.touchTechnique(selected.id);
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkAssimilated() {
    if (!selected) return;
    setBusy(true);
    try {
      await api.updateTechniqueStatus(selected.id, "Assimilated");
      setAssimilated(true);
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  if (techniques.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6 animate-fade-in">
        <h1 className="text-xl font-semibold">{t("recall.title")}</h1>
        <Card className="p-6 mt-4 text-sm text-muted-foreground rounded-lg border-border bg-card transition-colors duration-150">
          {t("recall.empty")}{" "}
          <Link to="/techniques" className="text-foreground underline">
            {t("techniques.title")}
          </Link>
        </Card>
      </div>
    );
  }

  if (phase === "setup" && selected) {
    return (
      <div className="max-w-3xl mx-auto p-6 animate-fade-in">
        <h1 className="text-xl font-semibold">{t("recall.title")}</h1>
        <p className="text-xs text-muted-foreground mt-1">{t("recall.subtitle")}</p>
        <Card className="p-5 mt-4 space-y-3 rounded-lg border-border bg-card transition-colors duration-150">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t("recall.technique")}</label>
            <Select value={techniqueId} onChange={(e) => setTechniqueId(e.target.value)}>
              {techniques.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} — {t(`techniques.status.${x.status}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t("common.language")}</label>
              <Select value={language} onChange={(e) => setLanguage(e.target.value as "cpp" | "java")}>
                <option value="cpp">C++17</option>
                <option value="java">Java</option>
              </Select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t("recall.duration")}</label>
              <Select value={String(minutes)} onChange={(e) => setMinutes(Number(e.target.value))}>
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button onClick={handleStart} className="w-full">
            {t("recall.start")}
          </Button>
        </Card>
      </div>
    );
  }

  if (phase === "session" && selected) {
    return (
      <div className="flex flex-col h-full bg-background animate-fade-in">
        <div className="flex items-center gap-2 px-3 h-11 border-b border-border shrink-0 bg-background">
          <span className="text-[13px] font-medium truncate">{selected.name}</span>
          <Badge variant="outline">{t(`techniques.status.${selected.status}`)}</Badge>
          <span
            className={`ml-auto font-mono text-sm tabular-nums ${remaining <= 60 ? "text-tle" : "text-muted-foreground"}`}
          >
            {formatClock(remaining)}
          </span>
          <Button size="sm" variant="success" onClick={() => setPhase("report")}>
            {t("recall.finish")}
          </Button>
        </div>
        <div className="flex-1 min-h-0 p-2">
          <div className="h-full rounded-lg border border-border overflow-hidden">
            <CodeEditor language={language} value={code} onChange={setCode} onLanguageChange={setLanguage} draftScope={selected.id} />
          </div>
        </div>
      </div>
    );
  }

  if (phase === "report" && selected) {
    return (
      <div className="max-w-3xl mx-auto p-6 animate-fade-in">
        <h1 className="text-xl font-semibold">{selected.name}</h1>
        <p className="text-xs text-muted-foreground mt-1">{t("recall.compareHint")}</p>
        <div className="grid md:grid-cols-2 gap-2 mt-4">
          <Card className="p-4 rounded-lg border-border bg-card transition-colors duration-150">
            <div className="text-xs font-medium text-muted-foreground mb-2">{t("recall.yourCode")}</div>
            <pre className="bg-black/40 border border-border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-words max-h-64 overflow-auto">
              {code || t("common.empty")}
            </pre>
          </Card>
          <Card className="p-4 rounded-lg border-border bg-card transition-colors duration-150">
            <div className="text-xs font-medium text-muted-foreground mb-2">{t("recall.yourNotes")}</div>
            <pre className="bg-black/40 border border-border rounded-lg p-3 text-xs whitespace-pre-wrap break-words max-h-64 overflow-auto font-sans">
              {selected.notes_md || t("recall.noNotes")}
            </pre>
          </Card>
        </div>
        {!outcome ? (
          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="success" onClick={() => handleOutcome("reconstructed")} disabled={busy}>
              {t("recall.reconstructed")}
            </Button>
            <Button variant="secondary" onClick={() => handleOutcome("partial")} disabled={busy}>
              {t("recall.partial")}
            </Button>
            <Button variant="secondary" onClick={() => handleOutcome("blocked")} disabled={busy}>
              {t("recall.blocked")}
            </Button>
          </div>
        ) : (
          <Card className="p-4 mt-4 rounded-lg border-border bg-card transition-colors duration-150 animate-fade-in">
            <div className="text-sm text-muted-foreground">{t("recall.recorded")}</div>
            {outcome === "reconstructed" && !assimilated && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-3">
                <span className="text-sm">{t("recall.markAssimilated")}</span>
                <Button size="sm" onClick={handleMarkAssimilated} disabled={busy} className="sm:ml-auto">
                  {t("recall.confirmAssimilated")}
                </Button>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setPhase("setup")}>
                {t("recall.again")}
              </Button>
              <Link to="/techniques" className="text-xs text-muted-foreground self-center hover:text-foreground transition-colors duration-150">
                {t("techniques.title")}
              </Link>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return null;
}
