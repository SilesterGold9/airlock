import { useEffect, useRef, useState } from "react";

interface TimerProps {
  durationMinutes: number;
  onExpire?: () => void;
  compact?: boolean;
}

export default function Timer({ durationMinutes, onExpire, compact = false }: TimerProps) {
  const totalSeconds = Number.isFinite(durationMinutes) && durationMinutes > 0
    ? Math.floor(durationMinutes * 60)
    : 0;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const expiredRef = useRef(false);
  const cbRef = useRef(onExpire);
  cbRef.current = onExpire;

  // Deadline-based: parent re-renders (new onExpire identity) restart the
  // interval but never the countdown, and interval drift cannot accumulate.
  useEffect(() => {
    const deadline = Date.now() + totalSeconds * 1000;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(interval);
        if (!expiredRef.current) {
          expiredRef.current = true;
          cbRef.current?.();
        }
      }
    }, 500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSeconds]);

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  const low = secondsLeft < 300; // last 5 minutes

  return (
    <div
      className={`tabular-nums tracking-wider ${
        compact
          ? `text-sm font-semibold ${low ? "text-wa animate-pulse" : "text-foreground"}`
          : `text-3xl font-bold ${low ? "text-wa animate-pulse" : "text-foreground"}`
      }`}
    >
      {pad(h)}:{pad(m)}:{pad(s)}
    </div>
  );
}
