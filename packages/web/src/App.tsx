import { Routes, Route, Navigate } from "react-router";

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
    <Routes>
      <Route path="/" element={<Navigate to="/equipes" replace />} />
      <Route path="/equipes" element={<Placeholder name="Equipes" />} />
      <Route path="/equipes/:id" element={<Placeholder name="Detail Equipe" />} />
      <Route path="/criterium" element={<Placeholder name="Criterium" />} />
      <Route
        path="/criterium/tours/:tour/joueurs/:licence"
        element={<Placeholder name="Detail Criterium" />}
      />
      <Route path="/progression" element={<Placeholder name="Progression" />} />
      <Route path="*" element={<Navigate to="/equipes" replace />} />
    </Routes>
  );
}
