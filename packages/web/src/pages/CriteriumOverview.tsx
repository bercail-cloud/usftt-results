import { useState } from "react";
import { useNavigate } from "react-router";
import { useCriteriumTours, useCriteriumTour } from "../hooks/use-criterium.js";
import { LoadingSkeleton } from "../components/LoadingSkeleton.js";
import { EmptyState } from "../components/EmptyState.js";
import { DivisionBadge } from "../components/DivisionBadge.js";

interface TourSummary {
  tour: number;
  date: string;
  usfttCount: number;
  divisions: Array<{ libelle: string; niveau: string }>;
}

interface JoueurResult {
  licence: string;
  nom: string;
  club: string;
  division: string;
  classement: number;
  victoires: number;
  defaites: number;
  rang: number;
  points: string;
}

const TOUR_LABELS = ["Tour 1", "Tour 2", "Tour 3", "Tour 4"];

function formatDivision(division: string): string {
  return division.replace(/^(?:FED|[A-Z]\d+)_/, "");
}

function getBilanColor(value: number): string {
  if (value > 0) return "text-success";
  if (value < 0) return "text-error";
  return "text-text-secondary";
}

function getBestBilan(joueurs: JoueurResult[]): JoueurResult | null {
  if (joueurs.length === 0) return null;
  return joueurs.reduce((best, j) => {
    const bilanJ = j.victoires - j.defaites;
    const bilanBest = best.victoires - best.defaites;
    return bilanJ > bilanBest ? j : best;
  });
}

function TourResultsTable({
  tour,
  tourDate,
  onRowClick,
}: {
  tour: number;
  tourDate?: string;
  onRowClick: (licence: string) => void;
}) {
  const { data, isLoading, isError } = useCriteriumTour(tour) as {
    data: JoueurResult[] | undefined;
    isLoading: boolean;
    isError: boolean;
  };

  if (isLoading) return <LoadingSkeleton lines={5} />;

  if (isError) {
    return <EmptyState message="Erreur lors du chargement des resultats" />;
  }

  const joueurs = data ?? [];

  if (joueurs.length === 0) {
    return <EmptyState message="Aucun resultat pour ce tour" />;
  }

  const totalVictoires = joueurs.reduce((s, j) => s + j.victoires, 0);
  const totalDefaites = joueurs.reduce((s, j) => s + j.defaites, 0);
  const bestBilan = getBestBilan(joueurs);

  return (
    <div className="space-y-4">
      {tourDate && (
        <p className="text-sm text-[#64748b]">Date : {tourDate}</p>
      )}

      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 text-center">
          <p className="text-xs text-[#64748b] mb-1">Joueurs engages</p>
          <p className="text-2xl font-bold text-[#0f172a]">{joueurs.length}</p>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 text-center">
          <p className="text-xs text-[#64748b] mb-1">Bilan global</p>
          <p className="text-xl font-bold">
            <span className="text-success">{totalVictoires}V</span>
            <span className="text-[#64748b] mx-1">/</span>
            <span className="text-error">{totalDefaites}D</span>
          </p>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 text-center">
          <p className="text-xs text-[#64748b] mb-1">Meilleur bilan</p>
          {bestBilan ? (
            <>
              <p className="text-sm font-bold text-[#0f172a] truncate">
                {bestBilan.nom}
              </p>
              <p className="text-xs">
                <span className="text-success">{bestBilan.victoires}V</span>
                <span className="text-[#64748b] mx-0.5">-</span>
                <span className="text-error">{bestBilan.defaites}D</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-[#94a3b8]">-</p>
          )}
        </div>
      </div>

      {/* Results table */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0]">
                <th className="text-left px-3 py-2 font-semibold text-[#64748b]">Joueur</th>
                <th className="text-center px-3 py-2 font-semibold text-[#64748b]">Division</th>
                <th className="text-center px-3 py-2 font-semibold text-[#64748b]">Classement</th>
                <th className="text-center px-3 py-2 font-semibold text-[#64748b]">Bilan</th>
                <th className="text-center px-3 py-2 font-semibold text-[#64748b]">Rang</th>
                <th className="text-center px-3 py-2 font-semibold text-[#64748b]">Points</th>
              </tr>
            </thead>
            <tbody>
              {joueurs.map((j) => {
                const bilan = j.victoires - j.defaites;
                return (
                  <tr
                    key={`${j.licence}-${j.division}`}
                    className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer transition-colors"
                    onClick={() => j.licence && onRowClick(j.licence)}
                  >
                    <td className="px-3 py-2 font-bold text-[#0f172a]">
                      {j.nom}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <DivisionBadge division={formatDivision(j.division)} />
                    </td>
                    <td className="px-3 py-2 text-center text-[#64748b]">
                      {j.classement}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-success">{j.victoires}V</span>
                      <span className="text-[#94a3b8] mx-0.5">-</span>
                      <span className="text-error">{j.defaites}D</span>
                    </td>
                    <td className="px-3 py-2 text-center text-[#64748b]">
                      {j.rang}
                    </td>
                    <td className={`px-3 py-2 text-center font-semibold ${getBilanColor(bilan)}`}>
                      {j.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CriteriumOverview() {
  const navigate = useNavigate();
  const { data: toursData, isLoading: toursLoading, isError: toursError } =
    useCriteriumTours() as {
      data: TourSummary[] | undefined;
      isLoading: boolean;
      isError: boolean;
    };

  const availableTours = toursData ?? [];
  const tourNumbers = availableTours.map((t) => t.tour);
  const hasRealTours = tourNumbers.some((t) => t > 0);
  const latestTour = hasRealTours
    ? (tourNumbers.filter((t) => t > 0).at(-1) ?? 1)
    : (tourNumbers[0] ?? 0);
  const [activeTour, setActiveTour] = useState<number | null>(null);

  const currentTour = activeTour ?? latestTour;
  const currentTourData = availableTours.find((t) => t.tour === currentTour);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a]">
          Criterium Federal
        </h1>
      </div>

      {/* Tour tabs */}
      {toursLoading && <LoadingSkeleton lines={1} />}

      {toursError && (
        <EmptyState message="Erreur lors du chargement des tours" />
      )}

      {!toursLoading && !toursError && (
        <>
          {hasRealTours && (
            <div className="flex gap-2 flex-wrap" role="tablist">
              {availableTours
                .filter((t) => t.tour > 0)
                .map((t) => {
                  const isActive = currentTour === t.tour;
                  return (
                    <button
                      key={t.tour}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTour(t.tour)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-[#0f172a] text-white"
                          : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
                      }`}
                    >
                      {TOUR_LABELS[t.tour - 1] ?? `Tour ${t.tour}`}
                      {t.date ? ` (${t.date})` : ""}
                    </button>
                  );
                })}
            </div>
          )}

          <TourResultsTable
            tour={currentTour}
            tourDate={currentTourData?.date}
            onRowClick={(licence) =>
              navigate(`/criterium/tours/${currentTour}/joueurs/${licence}`)
            }
          />
        </>
      )}
    </div>
  );
}
