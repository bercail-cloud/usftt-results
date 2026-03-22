import { Routes, Route, Navigate } from "react-router";
import { NavBar } from "./components/NavBar";
import { EquipesOverview } from "./pages/EquipesOverview";
import { EquipeDetail } from "./pages/EquipeDetail";
import { CriteriumOverview } from "./pages/CriteriumOverview";
import { CriteriumDetail } from "./pages/CriteriumDetail";
import { Progression } from "./pages/Progression";
import { ProgressionDetail } from "./pages/ProgressionDetail";

export function App() {
  return (
    <div className="min-h-screen bg-bg-page">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/equipes" replace />} />
          <Route path="/equipes" element={<EquipesOverview />} />
          <Route path="/equipes/:id" element={<EquipeDetail />} />
          <Route path="/criterium" element={<CriteriumOverview />} />
          <Route
            path="/criterium/tours/:tour/joueurs/:licence"
            element={<CriteriumDetail />}
          />
          <Route path="/progression" element={<Progression />} />
          <Route path="/progression/:licence" element={<ProgressionDetail />} />
          <Route path="*" element={<Navigate to="/equipes" replace />} />
        </Routes>
      </main>
    </div>
  );
}
