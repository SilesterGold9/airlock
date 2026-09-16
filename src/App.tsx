import { NavLink, Route, Routes } from "react-router-dom";
import Practice from "./pages/Practice";
import Contest from "./pages/Contest";
import Stress from "./pages/Stress";
import Import from "./pages/Import";
import History from "./pages/History";
import { LogoIcon } from "./components/Logo";

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <nav className="sticky top-0 z-50 h-12 flex items-center gap-3 bg-background/80 backdrop-blur-md border-b border-border px-4 shrink-0">
        <div className="flex items-center gap-2 mr-2">
          <LogoIcon size={28} />
          <span className="font-mono font-bold text-sm tracking-tight">Airlock</span>
          <span className="hidden sm:inline text-xs text-muted-foreground ml-1">offline-first cp trainer</span>
        </div>
        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
        {[
          { to: "/", label: "Practice" },
          { to: "/contest", label: "Contest" },
          { to: "/stress", label: "Stress" },
          { to: "/import", label: "Import" },
          { to: "/history", label: "History" },
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
