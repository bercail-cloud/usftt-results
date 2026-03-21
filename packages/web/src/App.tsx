import { Routes, Route, Navigate } from "react-router";
import { NavBar } from "./components/NavBar";
import { EquipesOverview } from "./pages/EquipesOverview";
import { EquipeDetail } from "./pages/EquipeDetail";

// Placeholder pages (will be replaced in later tasks)
function Placeholder({ name }: { name: string }) {
  return (
    <div className="p-8 text-text-primary">
      <h1 className="text-2xl font-bold">{name}</h1>
      <p className="text-text-secondary mt-2">A venir...</p>
    </div>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-bg-page">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/equipes" replace />} />
          <Route path="/equipes" element={<EquipesOverview />} />
          <Route path="/equipes/:id" element={<EquipeDetail />} />
          <Route path="/criterium" element={<Placeholder name="Criterium" />} />
          <Route
            path="/criterium/tours/:tour/joueurs/:licence"
            element={<Placeholder name="Detail Criterium" />}
          />
          <Route path="/progression" element={<Placeholder name="Progression" />} />
          <Route path="*" element={<Navigate to="/equipes" replace />} />
        </Routes>
      </main>
    </div>
  );
}
