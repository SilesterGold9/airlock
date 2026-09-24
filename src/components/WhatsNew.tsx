import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { LogoIcon } from "./Logo";
import { RELEASES_URL, entryFor } from "../lib/changelog";
import { useLocale, useT } from "../lib/i18n";

export default function WhatsNew({ version, onClose }: { version: string; onClose: () => void }) {
  const t = useT();
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);
  const entry = entryFor(version);
  const highlights = entry ? (locale === "pt" ? entry.pt : entry.en) : [];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(RELEASES_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable: the URL stays visible for manual copy
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6 animate-pop max-h-[85vh] overflow-y-auto" role="dialog" aria-modal="true" aria-label={t("whatsnew.title").replace("{v}", version)}>
        <div className="flex flex-col items-center text-center">
          <LogoIcon size={36} />
          <h1 className="text-lg font-semibold mt-3">
            {t("whatsnew.title").replace("{v}", version)}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">{t("whatsnew.sub")}</p>
        </div>
        {highlights.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm leading-relaxed">
                <span className="text-ac mt-0.5 shrink-0">→</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 rounded-lg border border-border bg-white/[0.02] px-3 py-2 flex items-center gap-2">
          <span className="text-xs font-mono truncate flex-1 text-muted-foreground">{RELEASES_URL}</span>
          <Button variant="secondary" size="sm" onClick={copyLink} className="shrink-0">
            {copied ? t("whatsnew.copied") : t("whatsnew.copyLink")}
          </Button>
        </div>
        <Button variant="success" onClick={onClose} className="w-full mt-4">
          {t("whatsnew.continue")}
        </Button>
      </Card>
    </div>
  );
}
