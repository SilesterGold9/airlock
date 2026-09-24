import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Contest, Submission } from "../lib/types";
import { usePersistentState } from "../lib/persist";
import { Button } from "./ui/button";
import { useT } from "../lib/i18n";

function CheckIcon({ done }: { done: boolean }) {
  return (
    <span
      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-150 ${
        done ? "bg-ac border-ac text-black" : "border-border text-transparent"
      }`}
      aria-hidden="true"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  );
}

// First-week checklist: ephemeral by design. Items check themselves off
// from the database plus the recall flag. Dismissing hides it for good.
export default function FirstWeekChecklist({ refreshKey }: { refreshKey: number }) {
  const t = useT();
  const [dismissed, setDismissed] = usePersistentState("airlock.checklist.dismissed", false);
  const [open, setOpen] = useState(true);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [recallDone, setRecallDone] = useState(false);

  useEffect(() => {
    api.listSubmissions().then(setSubs).catch(() => {});
    api.listContests().then(setContests).catch(() => {});
    try {
      setRecallDone(localStorage.getItem("airlock.recall.completed") === "1");
    } catch {
      // ignore
    }
  }, [refreshKey]);

  if (dismissed) return null;

  const items = [
    { key: "submit", done: subs.length > 0 },
    { key: "classify", done: subs.some((s) => s.failure_category != null) },
    { key: "recall", done: recallDone },
    { key: "contest", done: contests.length > 0 },
  ];
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shrink-0">
      <div className="flex items-center gap-2 px-3 h-10">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          aria-expanded={open}
        >
          <span className={`inline-block transition-transform duration-200 ${open ? "" : "-rotate-90"}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
          <span className="text-[13px] font-medium truncate">{t("checklist.title")}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {t("checklist.progress").replace("{done}", String(doneCount)).replace("{total}", String(items.length))}
          </span>
        </button>
        <div className="h-1.5 w-16 rounded-full bg-white/[0.06] overflow-hidden shrink-0">
          <div className="h-full bg-ac transition-all duration-200" style={{ width: `${(doneCount / items.length) * 100}%` }} />
        </div>
        <Button variant="ghost" size="sm" onClick={() => setDismissed(true)} aria-label={t("checklist.dismiss")}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 3L9 9M9 3L3 9" />
          </svg>
        </Button>
      </div>
      {open && (
        <ul className="px-3 pb-3 space-y-1 animate-fade-in">
          {items.map((item) => (
            <li
              key={item.key}
              className={`flex items-center gap-2 text-xs px-1 py-1 rounded-md ${item.done ? "text-muted-foreground" : "text-foreground"}`}
            >
              <CheckIcon done={item.done} />
              <span className={item.done ? "line-through" : ""}>{t(`checklist.${item.key}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
