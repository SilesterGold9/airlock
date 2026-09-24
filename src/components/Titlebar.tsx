import { getCurrentWindow } from "@tauri-apps/api/window";
import { useT } from "../lib/i18n";

function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI__" in window || "__TAURI_INTERNALS__" in window)
  );
}

export default function Titlebar() {
  const t = useT();
  if (!isTauriRuntime()) return null;

  async function minimize() {
    try {
      await getCurrentWindow().minimize();
    } catch (e) {
      console.error(e);
    }
  }
  async function toggleMaximize() {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (e) {
      console.error(e);
    }
  }
  async function close() {
    try {
      await getCurrentWindow().close();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={toggleMaximize}
      className="h-8 flex items-center justify-between bg-background border-b border-border select-none shrink-0"
    >
      <div className="w-20" />
      <div
        data-tauri-drag-region
        className="text-xs font-medium tracking-wide text-foreground/90"
      >
        Airlock
      </div>
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={minimize}
          onDoubleClick={(e) => e.stopPropagation()}
          className="w-8 h-8 flex items-center justify-center hover:bg-white/[0.06] rounded text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t("titlebar.minimize")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={toggleMaximize}
          onDoubleClick={(e) => e.stopPropagation()}
          className="w-8 h-8 flex items-center justify-center hover:bg-white/[0.06] rounded text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t("titlebar.maximize")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="2" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.2" rx="0.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={close}
          onDoubleClick={(e) => e.stopPropagation()}
          className="w-8 h-8 flex items-center justify-center hover:bg-wa/20 hover:text-wa rounded text-muted-foreground transition-colors"
          aria-label={t("titlebar.close")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
