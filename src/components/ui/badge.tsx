import * as React from "react";
import { useT } from "../../lib/i18n";

type BadgeVariant = "default" | "easy" | "medium" | "hard" | "outline";

const variants: Record<BadgeVariant, string> = {
  default: "bg-card border-border text-foreground",
  easy: "text-difficulty-easy bg-difficulty-easy/12 border-difficulty-easy/20",
  medium: "text-difficulty-medium bg-difficulty-medium/14 border-difficulty-medium/20",
  hard: "text-difficulty-hard bg-difficulty-hard/12 border-difficulty-hard/20",
  outline: "text-muted-foreground border-border",
};

export function Badge({
  variant = "default",
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: BadgeVariant }) {
  return (
    <div
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors duration-150 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: number }) {
  const t = useT();
  let label: string;
  let color: string;
  if (difficulty < 1000) {
    label = t("difficulty.easy");
    color = "#00af9b";
  } else if (difficulty < 1600) {
    label = t("difficulty.medium");
    color = "#ffc01e";
  } else {
    label = t("difficulty.hard");
    color = "#ff375f";
  }
  return (
    <div
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 whitespace-nowrap leading-none border"
      style={{ color, backgroundColor: `${color}1f`, borderColor: `${color}33` }}
    >
      {label}
      <span className="ml-1.5 font-mono font-bold tabular-nums opacity-90">{difficulty}</span>
    </div>
  );
}
