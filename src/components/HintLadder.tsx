import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { useT } from "../lib/i18n";

export const MAX_HINTS = 7;

// Progressive hint reveal for Practice mode. Levels 1-6 show on tap;
// level 7 (the only one that may contain code) needs an explicit inline
// confirmation, so it is never revealed by an accidental click.
export default function HintLadder({
  hints,
  revealed,
  onReveal,
}: {
  hints: string[];
  revealed: number;
  onReveal: (count: number) => void;
}) {
  const t = useT();
  const [arming, setArming] = useState(false);
  const levels = hints.slice(0, MAX_HINTS);

  useEffect(() => {
    setArming(false);
  }, [revealed]);

  if (levels.length === 0) return null;

  const exhausted = revealed >= levels.length;
  const nextIsSeventh = !exhausted && revealed === MAX_HINTS - 1 && levels.length === MAX_HINTS;

  return (
    <div className="mt-4 space-y-2">
      {levels.slice(0, revealed).map((h, i) => (
        <div
          key={i}
          className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2.5 animate-fade-in"
        >
          <div className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground mb-1">
            {t("practice.hint").replace("{n}", String(i + 1))}
          </div>
          <div className="text-sm whitespace-pre-wrap break-words">{h}</div>
        </div>
      ))}
      {!exhausted && !arming && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => (nextIsSeventh ? setArming(true) : onReveal(revealed + 1))}
        >
          {t("practice.stuck")}
        </Button>
      )}
      {arming && (
        <div className="rounded-lg border border-tle/30 bg-tle/10 px-3 py-2.5 animate-fade-in">
          <div className="text-xs text-muted-foreground mb-2">{t("practice.approachConfirm")}</div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onReveal(revealed + 1)}>
              {t("practice.showApproach")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setArming(false)}>
              {t("practice.notYet")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
