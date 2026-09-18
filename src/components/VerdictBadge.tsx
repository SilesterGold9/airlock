import type { Verdict } from "../lib/types";
import { getVerdictInfo } from "../lib/verdict";
import { useT } from "../lib/i18n";

export default function VerdictBadge({
  verdict,
  size = "sm",
  showLong = false,
}: {
  verdict: Verdict;
  size?: "sm" | "lg";
  showLong?: boolean;
}) {
  const t = useT();
  const info = getVerdictInfo(verdict);
  const longLabel = t(info.long);
  const description = t(info.description);
  const sizeClasses =
    size === "lg" ? "px-3.5 py-1.5 text-sm rounded-lg" : "px-2.5 py-0.5 text-xs rounded-full";
  return (
    <span
      title={`${longLabel}: ${description}`}
      className={`inline-flex items-center border font-medium transition-colors duration-150 ${sizeClasses} ${info.classes}`}
    >
      {showLong ? longLabel : info.short}
      {showLong && <span className="ml-1.5 opacity-60 font-normal text-xs">({info.short})</span>}
    </span>
  );
}
