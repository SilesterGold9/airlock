import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { TOURS, markTourDone, type TourDef } from "../lib/tours";
import { useT } from "../lib/i18n";

interface ActiveTour {
  def: TourDef;
  idx: number;
}

interface TourContextValue {
  active: ActiveTour | null;
  start: (id: string) => void;
  next: () => void;
  back: () => void;
  exit: (completed: boolean) => void;
}

const TourContext = createContext<TourContextValue>({
  active: null,
  start: () => {},
  next: () => {},
  back: () => {},
  exit: () => {},
});

export function useTour(): TourContextValue {
  return useContext(TourContext);
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TIP_W = 320;
const GAP = 12;

export default function TourProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState<ActiveTour | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const exit = useCallback((completed: boolean) => {
    setActive((a) => {
      if (a && completed) markTourDone(a.def.id);
      return null;
    });
    setRect(null);
  }, []);

  const start = useCallback(
    (id: string) => {
      const def = TOURS[id];
      if (!def) return;
      setActive({ def, idx: 0 });
      navigate(def.steps[0].route);
    },
    [navigate]
  );

  const next = useCallback(() => {
    setActive((a) => {
      if (!a) return a;
      if (a.idx + 1 >= a.def.steps.length) {
        markTourDone(a.def.id);
        return null;
      }
      const step = a.def.steps[a.idx + 1];
      navigate(step.route);
      return { def: a.def, idx: a.idx + 1 };
    });
    setRect(null);
  }, [navigate]);

  const back = useCallback(() => {
    setActive((a) => {
      if (!a || a.idx === 0) return a;
      const step = a.def.steps[a.idx - 1];
      navigate(step.route);
      return { def: a.def, idx: a.idx - 1 };
    });
    setRect(null);
  }, [navigate]);

  // Measure the step target: poll briefly so route changes and lazy chunks
  // (editor) have time to mount. Missing targets fall back to a centered card.
  useEffect(() => {
    if (!active) return;
    const step = active.def.steps[active.idx];
    let cancelled = false;
    let tries = 0;
    function measure(): Rect | null {
      const el = document.querySelector(step.selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    function attempt() {
      if (cancelled) return;
      const r = measure();
      if (r || tries >= 25) {
        if (!cancelled) setRect(r);
        return;
      }
      tries += 1;
      window.setTimeout(attempt, 100);
    }
    attempt();
    function remeasure() {
      if (!cancelled) setRect(measure());
    }
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [active, location.pathname]);

  useEffect(() => {
    if (active) primaryRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") exit(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, exit]);

  const step = active ? active.def.steps[active.idx] : null;
  const total = active ? active.def.steps.length : 0;
  const last = active ? active.idx === total - 1 : false;

  // Tooltip placement: below the target when it fits, else above, else
  // beside it (tall targets like the sidebar), else centered on screen.
  const placement: { style: React.CSSProperties; centered: boolean } = (() => {
    const centered: React.CSSProperties = {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: TIP_W,
      maxWidth: "calc(100vw - 24px)",
    };
    if (!rect || typeof window === "undefined") return { style: centered, centered: true };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const EST_H = 240;
    const base: React.CSSProperties = { width: TIP_W, maxWidth: "calc(100vw - 24px)" };
    const left = Math.max(12, Math.min(rect.x, vw - TIP_W - 12));
    const below = rect.y + rect.h + GAP;
    if (below + EST_H <= vh) return { style: { ...base, left, top: below }, centered: false };
    if (rect.y - GAP - EST_H >= 0) return { style: { ...base, left, bottom: vh - rect.y + GAP }, centered: false };
    const rightX = rect.x + rect.w + GAP;
    if (rightX + TIP_W <= vw - 12) {
      return { style: { ...base, left: rightX, top: Math.max(12, Math.min(rect.y, vh - EST_H - 12)) }, centered: false };
    }
    const leftX = rect.x - GAP - TIP_W;
    if (leftX >= 12) {
      return { style: { ...base, left: leftX, top: Math.max(12, Math.min(rect.y, vh - EST_H - 12)) }, centered: false };
    }
    return { style: centered, centered: true };
  })();

  return (
    <TourContext.Provider value={{ active, start, next, back, exit }}>
      {children}
      {active && step && (
        <div className="fixed inset-0 z-[85]">
          {rect ? (
            <>
              <div className="absolute left-0 right-0 top-0 bg-black/60 animate-fade-in" style={{ height: Math.max(0, rect.y - 4) }} onClick={() => exit(false)} />
              <div className="absolute left-0 right-0 bg-black/60 animate-fade-in" style={{ top: rect.y + rect.h + 4, bottom: 0 }} onClick={() => exit(false)} />
              <div className="absolute bg-black/60 animate-fade-in" style={{ top: Math.max(0, rect.y - 4), height: rect.h + 8, left: 0, width: Math.max(0, rect.x - 4) }} onClick={() => exit(false)} />
              <div className="absolute bg-black/60 animate-fade-in" style={{ top: Math.max(0, rect.y - 4), height: rect.h + 8, left: rect.x + rect.w + 4, right: 0 }} onClick={() => exit(false)} />
              <div
                className="absolute rounded-lg border-2 border-ac pointer-events-none animate-fade-in"
                style={{ left: rect.x - 4, top: rect.y - 4, width: rect.w + 8, height: rect.h + 8 }}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={() => exit(false)} />
          )}
          <Card
            className="absolute p-4 animate-pop max-h-[80vh] overflow-y-auto"
            style={placement.style}
            role="dialog"
            aria-modal="true"
          >
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {t("tour.stepOf").replace("{n}", String(active.idx + 1)).replace("{total}", String(total))}
            </div>
            <div className="text-sm font-semibold mt-1">{t(step.titleKey)}</div>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{t(step.bodyKey)}</p>
            <div className="flex items-center gap-2 mt-4">
              {active.idx > 0 ? (
                <Button variant="ghost" size="sm" onClick={back}>
                  {t("tour.back")}
                </Button>
              ) : (
                <span />
              )}
              <button
                onClick={() => exit(false)}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("tour.skip")}
              </button>
              <Button ref={primaryRef} size="sm" onClick={next}>
                {last ? t("tour.done") : t("tour.next")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </TourContext.Provider>
  );
}
