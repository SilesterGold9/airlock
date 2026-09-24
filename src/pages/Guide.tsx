import { GUIDE_SECTIONS } from "../lib/guide";
import { isTourDone, resetTour } from "../lib/tours";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useTour } from "../components/TourProvider";
import { useLocale, useT } from "../lib/i18n";
import { useState } from "react";

export default function Guide() {
  const t = useT();
  const { locale } = useLocale();
  const { start } = useTour();
  const [tourDone, setTourDone] = useState(() => isTourDone("first-run"));

  function replay() {
    resetTour("first-run");
    setTourDone(false);
    start("first-run");
  }

  return (
    <div className="max-w-3xl mx-auto p-6 animate-fade-in">
      <h1 className="text-xl font-semibold">{t("nav.guide")}</h1>
      <p className="text-sm text-muted-foreground mt-1">{t("guide.sub")}</p>

      <Card className="p-4 mt-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{t("guide.tourTitle")}</div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {t("guide.tourDesc")}
          </div>
        </div>
        {tourDone && (
          <Badge variant="outline" className="shrink-0">
            {t("guide.tourDone")}
          </Badge>
        )}
        <Button size="sm" variant={tourDone ? "secondary" : "success"} onClick={replay} className="shrink-0">
          {tourDone ? t("guide.replay") : t("guide.startTour")}
        </Button>
      </Card>

      {GUIDE_SECTIONS.map((s) => (
        <section key={s.title.en} className="mt-6">
          <h2 className="text-sm font-semibold">{locale === "pt" ? s.title.pt : s.title.en}</h2>
          <div className="mt-2 space-y-2">
            {(locale === "pt" ? s.body.pt : s.body.en).map((p) => (
              <p key={p.slice(0, 24)} className="text-sm text-muted-foreground leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
