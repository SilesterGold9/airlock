import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { RankReflection, RankState, RankTheme } from "../lib/types";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { useT } from "../lib/i18n";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function Journey() {
  const t = useT();
  const [themes, setThemes] = useState<RankTheme[]>([]);
  const [rank, setRank] = useState<RankState | null>(null);
  const [reflections, setReflections] = useState<RankReflection[]>([]);
  const [reflectionMd, setReflectionMd] = useState("");
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [recordError, setRecordError] = useState(false);

  async function refresh() {
    try {
      const [allThemes, state, allReflections] = await Promise.all([
        api.listRankThemes(),
        api.getRankState(),
        api.listRankReflections(),
      ]);
      setThemes(allThemes);
      setRank(state);
      setReflections(allReflections);
      setLoadError(false);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    }
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, []);

  const activeTheme: RankTheme | null = useMemo(() => {
    if (themes.length === 0) return null;
    return (
      (rank && themes.find((x) => x.id === rank.theme_id)) ||
      themes.find((x) => x.is_default) ||
      themes[0]
    );
  }, [themes, rank]);

  const currentStars = rank?.current_stars ?? 0;
  const tierIndex = Math.min(Math.max(currentStars, 0), 7);
  const tierName = activeTheme?.tier_names[tierIndex] ?? "";
  const tierColor = activeTheme?.tier_colors[tierIndex] ?? "#64748b";
  const pending = rank?.pending_suggestion ?? null;
  const pendingTier =
    pending != null && activeTheme ? activeTheme.tier_names[Math.min(pending, 7)] ?? "" : "";

  async function handleCheck() {
    setChecking(true);
    setRecordError(false);
    try {
      const state = await api.checkRankSuggestion();
      setRank(state);
      setChecked(true);
    } catch (e) {
      console.error(e);
      setRecordError(true);
    } finally {
      setChecking(false);
    }
  }

  async function handleThemeChange(themeId: string) {
    try {
      const state = await api.setActiveTheme(themeId);
      setRank(state);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleConfirm() {
    if (pending == null || !reflectionMd.trim()) return;
    setConfirming(true);
    setRecordError(false);
    try {
      const state = await api.confirmRankUp(pending, reflectionMd.trim());
      setRank(state);
      setReflectionMd("");
      const allReflections = await api.listRankReflections();
      setReflections(allReflections);
    } catch (e) {
      console.error(e);
      setRecordError(true);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 animate-fade-in">
      <h1 className="text-xl font-semibold">{t("journey.title")}</h1>
      <p className="text-xs text-muted-foreground mt-1">{t("journey.subtitle")}</p>

      {loadError && (
        <Card className="p-3 mt-3 text-xs text-muted-foreground">{t("journey.loadError")}</Card>
      )}

      {rank && activeTheme && (
        <Card className="p-3 mt-3">
          <div className="flex items-center gap-2.5">
            <span
              className="h-4 w-4 rounded-full shrink-0"
              style={{ backgroundColor: tierColor }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {t("journey.currentTier")}: {tierName}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                {t("journey.stars").replace("{current}", String(currentStars))}
                {" · "}
                {activeTheme.system_name}
              </div>
            </div>
            <Badge variant="outline" className="tabular-nums">
              {"★".repeat(currentStars) || "—"}
            </Badge>
          </div>
          <div className="grid gap-1 mt-3">
            <label className="text-xs font-medium text-muted-foreground">{t("journey.theme")}</label>
            <Select size="sm" value={activeTheme.id} onChange={(e) => handleThemeChange(e.target.value)}>
              {themes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.system_name}
                </option>
              ))}
            </Select>
          </div>
        </Card>
      )}

      {activeTheme && (
        <Card className="p-3 mt-3">
          <div className="text-sm font-semibold mb-1">{t("journey.tiers")}</div>
          <div className="grid gap-0.5">
            {activeTheme.tier_names.map((name, i) => {
              const achieved = rank?.achieved_at[String(i)];
              const reached = i <= currentStars && currentStars > 0 ? i <= currentStars : i === 0 && currentStars === 0;
              return (
                <div key={i} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors duration-150">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: activeTheme.tier_colors[i] ?? "#64748b" }}
                  />
                  <span className={reached ? "font-medium" : "text-muted-foreground"}>
                    {i === 0 ? name : `${t("journey.star").replace("{n}", String(i))} · ${name}`}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {achieved
                      ? t("journey.achievedOn").replace("{date}", formatDate(achieved))
                      : t("journey.notYet")}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-3 mt-3">
        <Button size="sm" onClick={handleCheck} disabled={checking}>
          {checking ? t("journey.checking") : t("journey.checkSuggestion")}
        </Button>
        {pending != null ? (
          <div className="mt-3 rounded-lg border border-border bg-white/[0.02] p-3 animate-fade-in">
            <div className="text-sm font-semibold">{t("journey.suggestionTitle")}</div>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {t("journey.suggestionBody")
                .replace("{star}", String(pending))
                .replace("{tier}", pendingTier)}
            </p>
            <div className="grid gap-1 mt-3">
              <label className="text-xs font-medium text-muted-foreground">
                {t("journey.reflectionLabel")}
              </label>
              <Textarea
                value={reflectionMd}
                onChange={(e) => setReflectionMd(e.target.value)}
                placeholder={t("journey.reflectionPlaceholder")}
                className="min-h-[80px] font-sans"
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={confirming || !reflectionMd.trim()}
              >
                {confirming
                  ? t("journey.confirming")
                  : t("journey.confirm").replace("{star}", String(pending))}
              </Button>
              {recordError && (
                <span className="text-xs text-muted-foreground">{t("journey.recordError")}</span>
              )}
            </div>
          </div>
        ) : (
          checked && (
            <p className="text-sm text-muted-foreground mt-3">{t("journey.noSuggestion")}</p>
          )
        )}
      </Card>

      <h2 className="text-sm font-semibold mt-4">{t("journey.timeline")}</h2>
      <div className="grid gap-2 mt-2">
        {reflections.map((r) => (
          <Card key={r.id} className="p-3 hover:bg-white/[0.02] transition-colors duration-150">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {t("journey.star").replace("{n}", String(r.star_level))}
              </Badge>
              <span className="text-xs text-muted-foreground tabular-nums">{formatDate(r.created_at)}</span>
            </div>
            <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap break-words">{r.reflection_md}</p>
          </Card>
        ))}
        {reflections.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">{t("journey.emptyTimeline")}</Card>
        )}
      </div>
    </div>
  );
}
