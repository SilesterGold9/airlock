import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { CORE_TECHNIQUES, SAMPLE_PROBLEMS } from "../lib/samples";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { LogoIcon } from "../components/Logo";
import { DoneArt, LoadArt, PathArt, SetupArt } from "../components/OnboardingArt";
import { useLocale, useT } from "../lib/i18n";

type Segment = "newbie" | "returner";
const STEPS = ["path", "setup", "load", "done"] as const;

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
  const [busy, setBusy] = useState(false);
  const [problemCount, setProblemCount] = useState(0);
  const [techniqueCount, setTechniqueCount] = useState(0);
  const [seededSamples, setSeededSamples] = useState(0);
  const [seededTechniques, setSeededTechniques] = useState(0);
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
  }, []);

  function pickSegment(s: Segment) {
    setSegment(s);
    localStorage.setItem("airlock.onboard.segment", s);
  }

  function finish() {
    localStorage.setItem("airlock.displayName", name.trim());
    localStorage.setItem("airlock.onboarded", "1");
    localStorage.removeItem("airlock.onboard.step");
    navigate("/", { replace: true });
  }

  async function handleLoadSamples() {
    setBusy(true);
    try {
      for (const p of SAMPLE_PROBLEMS) {
        await api.saveProblem({ ...p, id: "", tests: p.tests.map((x) => ({ ...x, id: "" })) });
      }
      setSeededSamples(SAMPLE_PROBLEMS.length);
      const all = await api.listProblems().catch(() => []);
      setProblemCount(all.length);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadTechniques() {
    setBusy(true);
    try {
      const created = [];
      for (const n of CORE_TECHNIQUES) {
        created.push(await api.saveTechnique(n));
      }
      await api.bulkUpdateTechniqueStatus(
        created.map((x) => x.id),
        "Learning"
      );
      setSeededTechniques(created.length);
      const all = await api.listTechniques().catch(() => []);
      setTechniqueCount(all.length);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  const step = STEPS[stepIdx];
  const samplesReady = problemCount > 0 || seededSamples > 0;
  const techniquesReady = techniqueCount > 0 || seededTechniques > 0;
  const loadReady = segment === "newbie" ? samplesReady : techniquesReady;
  const canContinue =
    (step === "path" && segment !== null) ||
    step === "setup" ||
    step === "done" ||
    (step === "load" && loadReady);

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 mb-6">
          <LogoIcon size={26} />
          <span className="font-mono font-bold text-sm tracking-tight">Airlock</span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
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

        <Card key={step} className="p-6 animate-panel-in" aria-live="polite">
          {step === "path" && (
            <>
              <div className="mx-auto w-44 mb-4">
                <PathArt />
              </div>
              <h1 className="text-xl font-semibold text-center">{t("welcome.pathTitle")}</h1>
              <p className="text-sm text-muted-foreground text-center mt-1 mb-5">{t("welcome.pathSub")}</p>
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
              <h1 className="text-xl font-semibold text-center">{t("welcome.setupTitle")}</h1>
              <p className="text-sm text-muted-foreground text-center mt-1 mb-5">{t("welcome.setupSub")}</p>
              <div className="grid gap-1 mb-4">
                <label className="text-xs font-medium text-muted-foreground">{t("onboard.name")}</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("onboard.namePlaceholder")}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">{t("common.language")}</label>
                <div className="flex gap-2">
                  <Button
                    variant={locale === "en" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setLocale("en")}
                  >
                    English
                  </Button>
                  <Button
                    variant={locale === "pt" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setLocale("pt")}
                  >
                    Português
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === "load" && segment === "newbie" && (
            <>
              <div className="mx-auto w-44 mb-4">
                <LoadArt />
              </div>
              <h1 className="text-xl font-semibold text-center">{t("welcome.loadNewbieTitle")}</h1>
              <p className="text-sm text-muted-foreground text-center mt-1 mb-5">
                {t("welcome.loadNewbieSub")}
              </p>
              <Button
                onClick={handleLoadSamples}
                disabled={busy || samplesReady}
                variant={samplesReady ? "secondary" : "success"}
                className="w-full"
              >
                {samplesReady
                  ? t("welcome.samplesReady").replace("{count}", String(Math.max(problemCount, seededSamples)))
                  : busy
                    ? t("welcome.loading")
                    : t("welcome.loadSamples")}
              </Button>
            </>
          )}

          {step === "load" && segment === "returner" && (
            <>
              <div className="mx-auto w-44 mb-4">
                <LoadArt />
              </div>
              <h1 className="text-xl font-semibold text-center">{t("welcome.loadReturnerTitle")}</h1>
              <p className="text-sm text-muted-foreground text-center mt-1 mb-5">
                {t("welcome.loadReturnerSub")}
              </p>
              <Button
                onClick={handleLoadTechniques}
                disabled={busy || techniquesReady}
                variant={techniquesReady ? "secondary" : "success"}
                className="w-full"
              >
                {techniquesReady
                  ? t("welcome.techniquesReady").replace(
                      "{count}",
                      String(Math.max(techniqueCount, seededTechniques))
                    )
                  : busy
                    ? t("welcome.loading")
                    : t("welcome.loadTechniques")}
              </Button>
            </>
          )}

          {step === "done" && (
            <>
              <div className="mx-auto w-44 mb-4">
                <DoneArt />
              </div>
              <h1 className="text-xl font-semibold text-center">{t("welcome.doneTitle")}</h1>
              <p className="text-sm text-muted-foreground text-center mt-1 mb-5">{t("welcome.doneSub")}</p>
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
              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <div className="text-xs font-semibold mb-2">{t("welcome.nextTitle")}</div>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li>→ {t("welcome.next1")}</li>
                  <li>→ {t("welcome.next2")}</li>
                  <li>→ {t("welcome.next3")}</li>
                </ul>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 mt-6">
            {stepIdx > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStepIdx(stepIdx - 1)}>
                {t("welcome.back")}
              </Button>
            ) : (
              <span />
            )}
            <button
              onClick={() => finish()}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("welcome.skip")}
            </button>
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
  );
}
