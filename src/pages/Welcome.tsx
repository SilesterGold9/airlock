import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { CORE_TECHNIQUES, SAMPLE_PROBLEMS } from "../lib/samples";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { LogoIcon } from "../components/Logo";
import { DoneArt, LoadArt, PathArt, SetupArt } from "../components/OnboardingArt";
import { useLocale, useT } from "../lib/i18n";

type Segment = "newbie" | "returner";
const STEPS = ["language", "path", "setup", "load", "done"] as const;

export default function Welcome() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(() =>
    Math.min(Number(localStorage.getItem("airlock.onboard.step") || 0), STEPS.length - 1)
  );
  const [segment, setSegment] = useState<Segment | null>(
    () => (localStorage.getItem("airlock.onboard.segment") as Segment | null) || null
  );
  const [name, setName] = useState(() => localStorage.getItem("airlock.displayName") || "");
  const [codeLang, setCodeLang] = useState(() => localStorage.getItem("airlock.defaultLang") || "cpp");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [problemCount, setProblemCount] = useState(0);
  const [techniqueCount, setTechniqueCount] = useState(0);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    localStorage.setItem("airlock.onboard.step", String(stepIdx));
    primaryRef.current?.focus();
  }, [stepIdx]);

  useEffect(() => {
    api.listProblems().then((p) => setProblemCount(p.length)).catch(() => {});
    api.listTechniques().then((x) => setTechniqueCount(x.length)).catch(() => {});
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function pickSegment(s: Segment) {
    setSegment(s);
    localStorage.setItem("airlock.onboard.segment", s);
  }

  function finish() {
    localStorage.setItem("airlock.displayName", name.trim());
    localStorage.setItem("airlock.defaultLang", codeLang);
    localStorage.setItem("airlock.onboarded", "1");
    localStorage.removeItem("airlock.onboard.step");
    navigate("/", { replace: true });
  }

  // Tops up by title/name instead of all-or-nothing: a vault that is
  // partially seeded (e.g. from an older bundle) heals to the full set.
  async function handleLoadAll() {
    if (busy) return;
    setBusy(true);
    setLoadError(false);
    try {
      const problems = await api.listProblems().catch(() => []);
      const knownTitles = new Set(problems.map((p) => p.title));
      for (const p of SAMPLE_PROBLEMS) {
        if (knownTitles.has(p.title)) continue;
        await api.saveProblem({ ...p, id: "", tests: p.tests.map((x) => ({ ...x, id: "" })) });
      }
      const techniques = await api.listTechniques().catch(() => []);
      const knownNames = new Set(techniques.map((x) => x.name));
      const created = [];
      for (const n of CORE_TECHNIQUES) {
        if (knownNames.has(n)) continue;
        created.push(await api.saveTechnique(n));
      }
      if (created.length > 0) {
        await api.bulkUpdateTechniqueStatus(
          created.map((x) => x.id),
          "Learning"
        );
      }
      const [allP, allT] = await Promise.all([
        api.listProblems().catch(() => []),
        api.listTechniques().catch(() => []),
      ]);
      setProblemCount(allP.length);
      setTechniqueCount(allT.length);
      if (allP.length < SAMPLE_PROBLEMS.length || allT.length < CORE_TECHNIQUES.length) {
        setLoadError(true);
      }
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setBusy(false);
    }
  }

  const step = STEPS[stepIdx];
  const vaultComplete =
    problemCount >= SAMPLE_PROBLEMS.length && techniqueCount >= CORE_TECHNIQUES.length;
  const canContinue =
    step === "language" ||
    (step === "path" && segment !== null) ||
    step === "setup" ||
    (step === "load" && vaultComplete) ||
    step === "done";

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <div className="flex flex-col items-center text-center mb-8 animate-fade-in">
            <LogoIcon size={44} />
            <div className="font-mono font-bold text-lg tracking-tight mt-3">Airlock</div>
            <div className="text-xs text-muted-foreground mt-1">{t("app.tagline")}</div>
            <Badge variant="outline" className="mt-3">
              {t("welcome.vaultStats")
                .replace("{problems}", String(SAMPLE_PROBLEMS.length))
                .replace("{techniques}", String(CORE_TECHNIQUES.length))}
            </Badge>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground tabular-nums ml-auto">
              {t("welcome.stepOf")
                .replace("{n}", String(stepIdx + 1))
                .replace("{total}", String(STEPS.length))}
            </span>
          </div>
          <div className="flex gap-1.5 mb-6" aria-hidden="true">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                  i <= stepIdx ? "bg-ac" : "bg-white/[0.08]"
                }`}
              />
            ))}
          </div>

          <Card key={step} className="p-8 animate-panel-in" aria-live="polite">
            {step === "language" && (
              <>
                <h1 className="text-2xl font-semibold text-center">{t("welcome.languageTitle")}</h1>
                <p className="text-sm text-muted-foreground text-center mt-2 mb-6">
                  {t("welcome.languageSub")}
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {(["en", "pt"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLocale(l)}
                      aria-pressed={locale === l}
                      className={`rounded-lg border p-5 text-left transition-all duration-150 active:scale-[0.98] ${
                        locale === l
                          ? "border-ac/50 bg-ac/[0.06]"
                          : "border-border hover:border-white/20 hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="text-base font-semibold">
                        {l === "en" ? "English" : "Português"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {l === "en" ? "All UI, problems stay as authored." : "Toda a UI, problemas mantidos no original."}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === "path" && (
              <>
                <div className="mx-auto w-44 mb-4">
                  <PathArt />
                </div>
                <h1 className="text-2xl font-semibold text-center">{t("welcome.pathTitle")}</h1>
                <p className="text-sm text-muted-foreground text-center mt-2 mb-6">{t("welcome.pathSub")}</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {(["newbie", "returner"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => pickSegment(s)}
                      aria-pressed={segment === s}
                      className={`rounded-lg border p-4 text-left transition-all duration-150 active:scale-[0.98] ${
                        segment === s
                          ? "border-ac/50 bg-ac/[0.06]"
                          : "border-border hover:border-white/20 hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="text-sm font-semibold">{t(`welcome.${s}Title`)}</div>
                      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {t(`welcome.${s}Desc`)}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === "setup" && (
              <>
                <div className="mx-auto w-44 mb-4">
                  <SetupArt />
                </div>
                <h1 className="text-2xl font-semibold text-center">{t("welcome.setupTitle")}</h1>
                <p className="text-sm text-muted-foreground text-center mt-2 mb-6">{t("welcome.setupSub")}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("onboard.name")}</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("onboard.namePlaceholder")}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("welcome.codeLang")}</label>
                    <Select value={codeLang} onChange={(e) => setCodeLang(e.target.value)}>
                      <option value="cpp">C++17</option>
                      <option value="java">Java</option>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {step === "load" && (
              <>
                <div className="mx-auto w-44 mb-4">
                  <LoadArt />
                </div>
                <h1 className="text-2xl font-semibold text-center">{t("welcome.loadAllTitle")}</h1>
                <p className="text-sm text-muted-foreground text-center mt-2 mb-6">
                  {t("welcome.loadAllSub")
                    .replace("{problems}", String(SAMPLE_PROBLEMS.length))
                    .replace("{techniques}", String(CORE_TECHNIQUES.length))}
                </p>
                <div className="flex items-center justify-center gap-2 mb-4 text-xs tabular-nums">
                  <Badge variant="outline">
                    {t("workspace.problemList")}: {problemCount}
                  </Badge>
                  <Badge variant="outline">
                    {t("nav.techniques")}: {techniqueCount}
                  </Badge>
                </div>
                <Button
                  onClick={handleLoadAll}
                  disabled={busy || vaultComplete}
                  variant={vaultComplete ? "secondary" : "success"}
                  className="w-full"
                >
                  {vaultComplete
                    ? t("welcome.loadAllReady")
                        .replace("{problems}", String(problemCount))
                        .replace("{techniques}", String(techniqueCount))
                    : busy
                      ? t("welcome.loading")
                      : t("welcome.loadAllButton")
                          .replace("{problems}", String(SAMPLE_PROBLEMS.length))
                          .replace("{techniques}", String(CORE_TECHNIQUES.length))}
                </Button>
                {loadError && (
                  <div className="text-xs text-wa text-center mt-3">{t("welcome.loadError")}</div>
                )}
              </>
            )}

            {step === "done" && (
              <>
                <div className="mx-auto w-44 mb-4">
                  <DoneArt />
                </div>
                <h1 className="text-2xl font-semibold text-center">{t("welcome.doneTitle")}</h1>
                <p className="text-sm text-muted-foreground text-center mt-2 mb-6">{t("welcome.doneSub")}</p>
                <div className="flex items-center justify-center gap-2 mb-6 text-xs tabular-nums">
                  <Badge variant="outline">
                    {problemCount} · {t("workspace.problemList")}
                  </Badge>
                  <Badge variant="outline">
                    {techniqueCount} · {t("nav.techniques")}
                  </Badge>
                </div>
                <div className="flex flex-col gap-2">
                  <Button ref={primaryRef} variant="success" onClick={() => finish()} className="w-full">
                    {t("welcome.openPractice")}
                  </Button>
                  <Link to="/techniques" onClick={() => finish()} className="block w-full">
                    <Button variant="secondary" className="w-full">
                      {t("welcome.viewTechniques")}
                    </Button>
                  </Link>
                </div>
                <div className="mt-6 border-t border-white/[0.06] pt-4">
                  <div className="text-xs font-semibold mb-2">{t("welcome.nextTitle")}</div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li>→ {t("welcome.next1")}</li>
                    <li>→ {t("welcome.next2")}</li>
                    <li>→ {t("welcome.next3")}</li>
                  </ul>
                </div>
              </>
            )}

            <div className="flex items-center gap-2 mt-8">
              {stepIdx > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setStepIdx(stepIdx - 1)}>
                  {t("welcome.back")}
                </Button>
              ) : (
                <span />
              )}
              {step !== "done" ? (
                <button
                  onClick={() => setStepIdx(stepIdx + 1)}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("welcome.skipStep")}
                </button>
              ) : (
                <span className="ml-auto" />
              )}
              {step !== "done" && (
                <Button
                  ref={primaryRef}
                  size="sm"
                  disabled={!canContinue}
                  onClick={() => setStepIdx(stepIdx + 1)}
                >
                  {t("welcome.continue")}
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
