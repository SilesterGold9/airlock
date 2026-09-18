import { NavLink, Route, Routes } from "react-router-dom";
import Practice from "./pages/Practice";
import Contest from "./pages/Contest";
import Stress from "./pages/Stress";
import Import from "./pages/Import";
import History from "./pages/History";
import { LogoIcon } from "./components/Logo";
import { useLocale, useT } from "./lib/i18n";
import Titlebar from "./components/Titlebar";

export default function App() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Titlebar />
      <nav className="sticky top-0 z-50 h-12 flex items-center gap-3 bg-background/80 backdrop-blur-md border-b border-border px-4 shrink-0">
        <div className="flex items-center gap-2 mr-2">
          <LogoIcon size={28} />
          <span className="font-mono font-bold text-sm tracking-tight">Airlock</span>
          <span className="hidden sm:inline text-xs text-muted-foreground ml-1">offline-first cp trainer</span>
        </div>
        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
        {[
          { to: "/", label: t("nav.practice") },
          { to: "/contest", label: t("nav.contest") },
          { to: "/stress", label: t("nav.stress") },
          { to: "/import", label: t("nav.import") },
          { to: "/history", label: t("nav.history") },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] ${
                isActive
                  ? "bg-white/[0.08] text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={() => setLocale(locale === "en" ? "pt" : "en")}
          className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-white/[0.06] transition-colors"
          title={locale === "en" ? "Mudar para Português" : "Switch to English"}
        >
          {locale === "en" ? "PT" : "EN"}
        </button>
      </nav>
      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<Practice />} />
          <Route path="/contest" element={<Contest />} />
          <Route path="/stress" element={<Stress />} />
          <Route path="/import" element={<Import />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </div>
  );
}
