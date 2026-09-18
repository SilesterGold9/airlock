import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { RankTheme } from "../lib/types";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { PanelTabs } from "../components/PanelTabs";
import { useLocale, useT } from "../lib/i18n";

type SettingsTab = "general" | "themes" | "data";

const DEFAULT_TIER_NAMES = ["0", "1", "2", "3", "4", "5", "6", "7"];
const DEFAULT_TIER_COLORS = ["#64748b", "#60a5fa", "#34d399", "#a3e635", "#facc15", "#fb923c", "#c084fc", "#eab308"];

export default function Settings() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SettingsTab>("general");

  const [name, setName] = useState(() => localStorage.getItem("airlock.displayName") || "");
  const [nameSaved, setNameSaved] = useState(false);
  const [defaultLang, setDefaultLang] = useState(() => localStorage.getItem("airlock.defaultLang") || "cpp");
  const [practiceTemplate, setPracticeTemplate] = useState(
    () => localStorage.getItem("airlock.practiceTemplate") || "analysis"
  );

  const [themes, setThemes] = useState<RankTheme[]>([]);
  const [activeThemeId, setActiveThemeId] = useState("");
  const [showNewTheme, setShowNewTheme] = useState(false);
  const [systemName, setSystemName] = useState("");
  const [tierNames, setTierNames] = useState<string[]>(DEFAULT_TIER_NAMES.map((n) => `Tier ${n}`));
  const [tierColors, setTierColors] = useState<string[]>([...DEFAULT_TIER_COLORS]);
  const [themeError, setThemeError] = useState("");
  const [themeBusy, setThemeBusy] = useState(false);

  const [subCount, setSubCount] = useState(0);
  const [clearing, setClearing] = useState(false);

  async function refreshThemes() {
    try {
      const [all, state] = await Promise.all([api.listRankThemes(), api.getRankState()]);
      setThemes(all);
      setActiveThemeId(state.theme_id);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    void refreshThemes();
    api
      .listSubmissions()
      .then((s) => setSubCount(s.length))
      .catch(() => {});
  }, []);

  function handleSaveName() {
    localStorage.setItem("airlock.displayName", name.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  function handleDefaultLang(lang: string) {
    setDefaultLang(lang);
    localStorage.setItem("airlock.defaultLang", lang);
  }

  function handlePracticeTemplate(v: string) {
    setPracticeTemplate(v);
    localStorage.setItem("airlock.practiceTemplate", v);
  }

  function handleReplayWelcome() {
    localStorage.removeItem("airlock.onboarded");
    localStorage.removeItem("airlock.onboard.step");
    localStorage.removeItem("airlock.onboard.segment");
    navigate("/welcome", { replace: true });
  }

  async function handleSetActive(themeId: string) {
    setThemeBusy(true);
    try {
      const state = await api.setActiveTheme(themeId);
      setActiveThemeId(state.theme_id);
    } catch (e) {
      console.error(e);
    } finally {
      setThemeBusy(false);
    }
  }

  async function handleCreateTheme() {
    setThemeError("");
    if (!systemName.trim()) {
      setThemeError(t("settings.themeNameRequired"));
      return;
    }
    if (tierNames.some((n) => !n.trim())) {
      setThemeError(t("settings.tierNamesRequired"));
      return;
    }
    setThemeBusy(true);
    try {
      await api.createRankTheme({
        systemName: systemName.trim(),
        tierNames: tierNames.map((n) => n.trim()),
        tierColors,
      });
      setSystemName("");
      setShowNewTheme(false);
      await refreshThemes();
    } catch (e) {
      setThemeError(String(e));
    } finally {
      setThemeBusy(false);
    }
  }

  async function handleClearHistory() {
    const ok = window.confirm(t("history.confirmClear").replace("{count}", String(subCount)));
    if (!ok) return;
    setClearing(true);
    try {
      await api.clearSubmissions();
      setSubCount(0);
    } catch (e) {
      console.error(e);
    } finally {
      setClearing(false);
    }
  }

  async function handleResetAll() {
    const ok = window.confirm(t("history.confirmReset"));
    if (!ok) return;
    setClearing(true);
    try {
      await api.clearAllData();
      setSubCount(0);
    } catch (e) {
      console.error(e);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 animate-fade-in">
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
      <div className="mt-4 rounded-lg border border-border bg-card overflow-hidden">
        <PanelTabs
          active={tab}
          onChange={(id) => setTab(id as SettingsTab)}
          tabs={[
            { id: "general", label: t("settings.general") },
            { id: "themes", label: t("settings.themes") },
            { id: "data", label: t("settings.data") },
          ]}
        />
        <div className="p-5 space-y-5">
          {tab === "general" && (
            <div key="general" className="space-y-5 animate-panel-in">
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">{t("common.language")}</label>
                <div className="flex gap-2">
                  <Button variant={locale === "en" ? "primary" : "secondary"} size="sm" onClick={() => setLocale("en")}>
                    English
                  </Button>
                  <Button variant={locale === "pt" ? "primary" : "secondary"} size="sm" onClick={() => setLocale("pt")}>
                    Português
                  </Button>
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">{t("onboard.name")}</label>
                <div className="flex gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("onboard.namePlaceholder")}
                  />
                  <Button size="sm" onClick={handleSaveName} className="shrink-0">
                    {t("common.save")}
                  </Button>
                </div>
                {nameSaved && <span className="text-xs text-muted-foreground">{t("common.saved")}</span>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("settings.defaultLang")}</label>
                  <Select value={defaultLang} onChange={(e) => handleDefaultLang(e.target.value)}>
                    <option value="cpp">C++17</option>
                    <option value="java">Java</option>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("settings.practiceTemplate")}</label>
                  <Select value={practiceTemplate} onChange={(e) => handlePracticeTemplate(e.target.value)}>
                    <option value="analysis">{t("settings.templateAnalysis")}</option>
                    <option value="standard">{t("settings.templateStandard")}</option>
                  </Select>
                </div>
              </div>
              <Card className="p-4 bg-background">
                <div className="text-sm font-semibold">{t("settings.replayTitle")}</div>
                <div className="text-xs text-muted-foreground mt-1 mb-3 leading-relaxed">
                  {t("settings.replayDesc")}
                </div>
                <Button variant="secondary" size="sm" onClick={handleReplayWelcome}>
                  {t("settings.replay")}
                </Button>
              </Card>
            </div>
          )}

          {tab === "themes" && (
            <div key="themes" className="space-y-3 animate-panel-in">
              <p className="text-xs text-muted-foreground leading-relaxed">{t("settings.themesHint")}</p>
              {themes.map((th) => {
                const isActive = th.id === activeThemeId;
                return (
                  <div
                    key={th.id}
                    className={`rounded-lg border p-3 transition-colors duration-150 ${
                      isActive ? "border-ac/40 bg-ac/[0.04]" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold flex-1 truncate">{th.system_name}</span>
                      {th.is_default && (
                        <span className="text-[10px] text-muted-foreground border border-border rounded-full px-1.5 py-px">
                          {t("settings.builtin")}
                        </span>
                      )}
                      {!isActive && (
                        <Button size="sm" variant="secondary" disabled={themeBusy} onClick={() => handleSetActive(th.id)}>
                          {t("settings.setActive")}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {th.tier_colors.map((c, i) => (
                        <span
                          key={i}
                          title={th.tier_names[i] || ""}
                          className="h-4 flex-1 rounded-sm border border-white/10"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1.5 truncate">
                      {th.tier_names.join(" · ")}
                    </div>
                  </div>
                );
              })}
              {!showNewTheme ? (
                <Button variant="secondary" size="sm" onClick={() => setShowNewTheme(true)}>
                  {t("settings.newTheme")}
                </Button>
              ) : (
                <Card className="p-4 bg-background space-y-3 animate-fade-in">
                  <div className="grid gap-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("settings.systemName")}</label>
                    <Input
                      value={systemName}
                      onChange={(e) => setSystemName(e.target.value)}
                      placeholder={t("settings.systemNamePh")}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    {tierNames.map((n, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-10 h-6 rounded border border-white/10 shrink-0" style={{ backgroundColor: tierColors[i] }} />
                        <input
                          type="color"
                          value={tierColors[i]}
                          onChange={(e) =>
                            setTierColors(tierColors.map((c, idx) => (idx === i ? e.target.value : c)))
                          }
                          className="w-8 h-8 p-0.5 bg-input border border-border rounded-md cursor-pointer shrink-0"
                          aria-label={t("settings.tierColor").replace("{n}", String(i))}
                        />
                        <Input
                          value={n}
                          onChange={(e) => setTierNames(tierNames.map((x, idx) => (idx === i ? e.target.value : x)))}
                          placeholder={t("settings.tierName").replace("{n}", String(i))}
                          className="h-8 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                  {themeError && <div className="text-xs text-wa">{themeError}</div>}
                  <div className="flex gap-2">
                    <Button size="sm" disabled={themeBusy} onClick={handleCreateTheme}>
                      {t("settings.create")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewTheme(false)}>
                      {t("settings.cancel")}
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {tab === "data" && (
            <div key="data" className="space-y-5 animate-panel-in">
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">{t("settings.dataDir")}</label>
                <Textarea
                  readOnly
                  value="~/.local/share/com.silvestre.airlock/airlock.sqlite"
                  className="min-h-0 h-9 font-mono text-xs"
                  onFocus={(e) => e.target.select()}
                />
                <span className="text-[11px] text-muted-foreground">{t("settings.dataDirHint")}</span>
              </div>
              <Card className="p-4 border-wa/30 bg-background">
                <div className="text-sm font-semibold text-wa">{t("settings.danger")}</div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={clearing || subCount === 0}
                    onClick={handleClearHistory}
                  >
                    {clearing ? t("common.clearing") : `${t("common.clearHistory")} (${subCount})`}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={clearing} onClick={handleResetAll}>
                    {t("common.resetAll")}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
