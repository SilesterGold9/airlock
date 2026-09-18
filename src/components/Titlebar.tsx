import { getCurrentWindow } from "@tauri-apps/api/window";
import { useT } from "../lib/i18n";

export default function Titlebar() {
  const t = useT();
  const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
  if (!isTauri) return null;

  async function minimize() {
    if (!isTauri) return;
    await getCurrentWindow().minimize();
  }
  async function maximize() {
    if (!isTauri) return;
    const w = getCurrentWindow();
    const isMax = await w.isMaximized();
    if (isMax) await w.unmaximize();
    else await w.maximize();
  }
  async function close() {
    if (!isTauri) return;
    await getCurrentWindow().close();
  }

  // When running in browser (vite dev without Tauri), don't show window controls
  // and make the bar just a thin drag region that looks integrated.
  return (
    <div
      data-tauri-drag-region
      className="h-8 flex items-center justify-between bg-background border-b border-border select-none shrink-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="w-20" />
      <div data-tauri-drag-region className="text-xs font-medium tracking-wide text-foreground/90">
        Airlock
      </div>
      <div className="flex items-center gap-1 pr-1">
        {isTauri ? (
          <>
            <button
              onClick={minimize}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/[0.06] rounded text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("titlebar.minimize")}
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={maximize}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/[0.06] rounded text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("titlebar.maximize")}
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.2" rx="0.5" />
              </svg>
            </button>
            <button
              onClick={close}
              className="w-8 h-8 flex items-center justify-center hover:bg-wa/20 hover:text-wa rounded text-muted-foreground transition-colors"
              aria-label={t("titlebar.close")}
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </>
        ) : (
          <div className="w-20" />
        )}
      </div>
    </div>
  );
}
