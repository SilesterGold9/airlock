import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Practice from "./pages/Practice";
import Contest from "./pages/Contest";
import Stress from "./pages/Stress";
import Import from "./pages/Import";
import History from "./pages/History";
import Techniques from "./pages/Techniques";
import Recall from "./pages/Recall";
import Journey from "./pages/Journey";
import Welcome from "./pages/Welcome";
import Settings from "./pages/Settings";
import Titlebar from "./components/Titlebar";
import Sidebar from "./components/Sidebar";
import { api } from "./lib/api";

export default function App() {
  const location = useLocation();
  const onboarded = localStorage.getItem("airlock.onboarded") === "1";
  if (!onboarded && location.pathname !== "/welcome") {
    return <Navigate to="/welcome" replace />;
  }

  useEffect(() => {
    const seeded = localStorage.getItem("airlock.seededSamples") === "1";
    if (!seeded) {
      api.seedSampleProblems()
        .then((count) => {
          if (count > 0) console.log(`Seeded ${count} sample problems`);
          localStorage.setItem("airlock.seededSamples", "1");
        })
        .catch(() => {
          localStorage.setItem("airlock.seededSamples", "1");
        });
    }
  }, []);
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Titlebar />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 min-h-0 min-w-0">
          <Routes>
            <Route path="/" element={<Practice />} />
            <Route path="/techniques" element={<Techniques />} />
            <Route path="/recall" element={<Recall />} />
            <Route path="/contest" element={<Contest />} />
            <Route path="/stress" element={<Stress />} />
            <Route path="/import" element={<Import />} />
            <Route path="/history" element={<History />} />
            <Route path="/journey" element={<Journey />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
