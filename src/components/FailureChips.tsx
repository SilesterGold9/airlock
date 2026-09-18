import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { FailureCategory } from "../lib/types";
import { useT } from "../lib/i18n";

const CATEGORIES: FailureCategory[] = [
  "Conceptual",
  "Implementation",
  "StlGap",
  "Indexing",
  "Careless",
  "MisreadStatement",
  "PrematureTechnique",
];

// Shown after a non-AC verdict. Optional, never blocks moving on:
// tapping a chip tags the latest submission for this problem.
export default function FailureChips({
  problemId,
  attemptKey,
}: {
  problemId: string;
  attemptKey: number;
}) {
  const t = useT();
  const [picked, setPicked] = useState<FailureCategory | null>(null);

  useEffect(() => {
    setPicked(null);
  }, [problemId, attemptKey]);

  async function pick(category: FailureCategory) {
    setPicked(category);
    try {
      await api.classifySubmission(problemId, category);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="mt-3 border-t border-white/[0.04] pt-3">
      <div className="text-xs text-muted-foreground mb-2">{t("failure.question")}</div>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => pick(c)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-all duration-150 active:scale-95 ${
              picked === c
                ? "border-ac/60 bg-ac/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            }`}
          >
            {t(`failure.${c}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
