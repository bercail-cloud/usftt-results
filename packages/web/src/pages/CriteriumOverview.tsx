import { useState } from "react";
import { useNavigate } from "react-router";
import { useCriteriumTours, useCriteriumTour } from "../hooks/use-criterium.js";
import { LoadingSkeleton } from "../components/LoadingSkeleton.js";
import { EmptyState } from "../components/EmptyState.js";
import { RankCircle } from "../components/RankCircle.js";

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

// Parse division to extract level code, age category and gender
function parseDivision(raw: string): {
  niveauOrder: number;
  niveauLabel: string;
  levelCode: string;
  ageCategory: string;
  ageOrder: number;
  gender: string;
  display: string;
} {
  const cleaned = raw
    .replace(/^FED_/, "")
    .replace(/^L\d+_/, "")
    .replace(/^D\d+[-_]?/, "");

  // Extract gender from end
  const genderMatch = raw.match(/\(([MF,]+)\)\s*$/);
  const gender = genderMatch ? genderMatch[1]! : "";

  // Determine niveau
  let niveauOrder = 3;
  let niveauLabel = "Departemental";
  let levelCode = "";

  if (raw === "Non publie" || raw === "") {
    niveauOrder = 4;
    niveauLabel = "Non publie";
    levelCode = "?";
    return {
      niveauOrder,
      niveauLabel,
      levelCode,
      ageCategory: "Non classe",
      ageOrder: 99,
      gender: "",
      display: raw,
    };
  }

  if (raw.startsWith("FED_") || raw.includes("N1") || raw.includes("N2")) {
    niveauOrder = 1;
    niveauLabel = "National";
    const nMatch = raw.match(/N(\d)/);
    const nLevel = nMatch ? nMatch[1] : "1";
    // FED_N1_Seniors xxx A (F) → N1a, FED_N1_Seniors xxx B (M) → N1b
    const subGroupMatch = raw.match(/\b([AB])\s*\(/);
    const subGroup = subGroupMatch ? subGroupMatch[1]!.toLowerCase() : "";
    levelCode = `N${nLevel}${subGroup}`;
  } else if (raw.startsWith("L") && raw.includes("_R")) {
    niveauOrder = 2;
    niveauLabel = "Regional";
    const rMatch = raw.match(/R(\d)/);
    levelCode = rMatch ? `R${rMatch[1]}` : "R1";
  } else {
    // Match "_D2", "-D1", etc. (the division level, not the department code D94)
    const dMatch = raw.match(/[_-]D(\d)/);
    levelCode = dMatch ? `D${dMatch[1]}` : "D1";
  }

  // Extract age category - ordered: Elite, Seniors, Juniors, Cadets, Minimes, Benjamins, Poussins
  let ageCategory = "Seniors";
  let ageOrder = 2;

  if (/[Ee]lite/i.test(raw)) { ageCategory = "Elite"; ageOrder = 1; }
  else if (/[Ss]enior/i.test(raw)) { ageCategory = "Seniors"; ageOrder = 2; }
  else if (/[Jj]unior/i.test(raw) || /-?\s*19\s*ans/i.test(raw)) { ageCategory = "Juniors (-19 ans)"; ageOrder = 3; }
  else if (/[Cc]adet/i.test(raw) || /-?\s*15\s*ans/i.test(raw)) { ageCategory = "Cadets (-15 ans)"; ageOrder = 4; }
  else if (/[Mm]inime/i.test(raw)) { ageCategory = "Minimes"; ageOrder = 5; }
  else if (/-?\s*13\s*ans/i.test(raw)) { ageCategory = "Benjamins (-13 ans)"; ageOrder = 6; }
  else if (/-?\s*11\s*ans/i.test(raw)) { ageCategory = "Poussins (-11 ans)"; ageOrder = 7; }

  const genderLabel = gender.includes("F")
    ? gender === "F" ? "Dames" : "Mixte"
    : "Messieurs";

  return {
    niveauOrder,
    niveauLabel,
    levelCode,
    ageCategory,
    ageOrder,
    gender: genderLabel,
    display: cleaned.replace(/\s*\([MF,]+\)\s*$/, "").trim(),
  };
}

// Group players by niveau > ageCategory
interface GroupedSection {
  niveauOrder: number;
  niveauLabel: string;
  ageGroups: Array<{
    ageCategory: string;
    players: Array<JoueurResult & {
      levelCode: string;
      gender: string;
    }>;
  }>;
}

function groupPlayers(joueurs: JoueurResult[]): GroupedSection[] {
  const niveauMap = new Map<string, {
    order: number;
    label: string;
    ageMap: Map<string, { order: number; players: Array<JoueurResult & { levelCode: string; levelNum: number; gender: string }> }>;
  }>();

  for (const j of joueurs) {
    const parsed = parseDivision(j.division);
    const key = parsed.niveauLabel;

    if (!niveauMap.has(key)) {
      niveauMap.set(key, { order: parsed.niveauOrder, label: key, ageMap: new Map() });
    }

    const niveau = niveauMap.get(key)!;
    const ageKey = `${parsed.ageCategory} ${parsed.gender}`;

    if (!niveau.ageMap.has(ageKey)) {
      niveau.ageMap.set(ageKey, { order: parsed.ageOrder, players: [] });
    }

    // Parse levelCode for sorting: N1a=10, N1b=11, N2=20, R1=10, R2=20, D1=10, D2=20...
    const levelDigit = parseInt(parsed.levelCode.replace(/[^0-9]/g, ""), 10) || 0;
    const subLetter = parsed.levelCode.match(/[a-z]$/)?.[0] ?? "";
    const levelNum = levelDigit * 10 + (subLetter === "a" ? 0 : subLetter === "b" ? 1 : 0);
    niveau.ageMap.get(ageKey)!.players.push({
      ...j,
      levelCode: parsed.levelCode,
      levelNum,
      gender: parsed.gender,
    });
  }

  const sections: GroupedSection[] = [];

  for (const [, niveau] of niveauMap) {
    const ageGroups = Array.from(niveau.ageMap.entries())
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([ageCategory, { players }]) => ({
        ageCategory,
        players: players.sort((a, b) => a.levelNum - b.levelNum || a.rang - b.rang),
      }));

    sections.push({
      niveauOrder: niveau.order,
      niveauLabel: niveau.label,
      ageGroups,
    });
  }

  return sections.sort((a, b) => a.niveauOrder - b.niveauOrder);
}

function getNiveauColor(niveau: string): string {
  switch (niveau) {
    case "National": return "text-blue-700 bg-blue-50 border-blue-200";
    case "Regional": return "text-purple-700 bg-purple-50 border-purple-200";
    case "Non publie": return "text-gray-600 bg-gray-50 border-gray-200";
    default: return "text-amber-700 bg-amber-50 border-amber-200";
  }
}

function getLevelBadgeColor(code: string): string {
  if (code === "?") return "bg-gray-100 text-gray-500";
  if (code.startsWith("N")) return "bg-blue-100 text-blue-700";
  if (code.startsWith("R")) return "bg-purple-100 text-purple-700";
  return "bg-amber-100 text-amber-700";
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
  if (isError) return <EmptyState message="Erreur lors du chargement des resultats" />;

  const joueurs = data ?? [];
  if (joueurs.length === 0) return <EmptyState message="Aucun resultat pour ce tour" />;

  const totalVictoires = joueurs.reduce((s, j) => s + j.victoires, 0);
  const totalDefaites = joueurs.reduce((s, j) => s + j.defaites, 0);
  const bestBilan = joueurs.reduce((best, j) => {
    const bilanJ = j.victoires - j.defaites;
    const bilanBest = best.victoires - best.defaites;
    return bilanJ > bilanBest ? j : best;
  });

  const grouped = groupPlayers(joueurs);

  return (
    <div className="space-y-4">
      {tourDate && (
        <p className="text-sm text-[#64748b]">Date : {tourDate}</p>
      )}

      {/* Summary cards */}
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
          <p className="text-sm font-bold text-[#0f172a] truncate">{bestBilan.nom}</p>
          <p className="text-xs">
            <span className="text-success">{bestBilan.victoires}V</span>
            <span className="text-[#64748b] mx-0.5">-</span>
            <span className="text-error">{bestBilan.defaites}D</span>
          </p>
        </div>
      </div>

      {/* Grouped results */}
      {grouped.map((section) => (
        <div key={section.niveauLabel} className={`border rounded-lg overflow-hidden ${getNiveauColor(section.niveauLabel)}`}>
          {/* Niveau header */}
          <div className="px-5 py-3 font-bold text-base">
            {section.niveauLabel}
          </div>

          <div className="bg-white">
            {section.ageGroups.map((group) => (
              <div key={group.ageCategory}>
                {/* Age category header */}
                <div className="px-5 py-2 bg-[#f8fafc] border-t border-[#e2e8f0]">
                  <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                    {group.ageCategory}
                  </span>
                </div>

                {/* Players in this group */}
                {group.players.map((j) => (
                  <div
                    key={`${j.licence}-${j.division}`}
                    className="flex items-center px-5 py-2.5 border-t border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer transition-colors"
                    onClick={() => j.licence && onRowClick(j.licence)}
                  >
                    {/* Level badge */}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getLevelBadgeColor(j.levelCode)} mr-3 min-w-[28px] text-center`}>
                      {j.levelCode}
                    </span>

                    {/* Name */}
                    <span className="font-semibold text-[#0f172a] flex-1 text-sm">
                      {j.nom}
                    </span>

                    {/* Classement */}
                    <span className="text-[#64748b] text-sm w-16 text-center">
                      {j.classement || "-"}
                    </span>

                    {/* Bilan */}
                    <span className="w-20 text-center text-sm">
                      <span className="text-success font-medium">{j.victoires}V</span>
                      <span className="text-[#94a3b8] mx-0.5">-</span>
                      <span className="text-error font-medium">{j.defaites}D</span>
                    </span>

                    {/* Rang */}
                    <span className="w-12 flex justify-center">
                      <RankCircle rank={j.rang} />
                    </span>

                    {/* Points */}
                    <span className="text-sm font-semibold text-[#0f172a] w-16 text-right">
                      {j.points}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
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
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a]">
          Criterium Federal
        </h1>
      </div>

      {toursLoading && <LoadingSkeleton lines={1} />}
      {toursError && <EmptyState message="Erreur lors du chargement des tours" />}

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
