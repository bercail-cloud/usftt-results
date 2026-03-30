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
  prenom?: string;
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
  let niveauOrder: number;
  let niveauLabel: string;
  let levelCode: string;

  if (raw === "Non publie" || raw === "") {
    niveauOrder = 4;
    niveauLabel = "Resultats non trouves sur la FFTT";  // key value, displayed via formatNiveauLabel
    levelCode = "?";
    return {
      niveauOrder,
      niveauLabel,
      levelCode,
      ageCategory: "",
      ageOrder: 0,
      gender: "",
      display: raw,
    };
  }

  if (raw.startsWith("FED_") || raw.startsWith("Z0") || raw.includes("N1") || raw.includes("N2")) {
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
    niveauOrder = 3;
    niveauLabel = "Departemental";
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
  else if (/[Bb]enjamin/i.test(raw) || /-?\s*13\s*ans/i.test(raw)) { ageCategory = "Benjamins (-13 ans)"; ageOrder = 6; }
  else if (/[Pp]oussin/i.test(raw) || /-?\s*11\s*ans/i.test(raw)) { ageCategory = "Poussins (-11 ans)"; ageOrder = 7; }

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
        players: players.sort((a, b) => {
          // For "Non publie" players (levelCode "?"), sort by classement DESC
          if (a.levelCode === "?" && b.levelCode === "?") {
            return (b.classement ?? 0) - (a.classement ?? 0);
          }
          return a.levelNum - b.levelNum || a.rang - b.rang;
        }),
      }));

    sections.push({
      niveauOrder: niveau.order,
      niveauLabel: niveau.label,
      ageGroups,
    });
  }

  return sections.sort((a, b) => a.niveauOrder - b.niveauOrder);
}

function getNiveauAccentBar(niveau: string): string {
  switch (niveau) {
    case "National": return "border-l-[4px] border-l-[#2563eb]";
    case "Regional": return "border-l-[4px] border-l-[#7c3aed]";
    case "Resultats non trouves sur la FFTT": return "border-l-[4px] border-l-[#94a3b8]";
    default: return "border-l-[4px] border-l-[#d97706]";
  }
}

function getNiveauHeaderColor(niveau: string): string {
  switch (niveau) {
    case "National": return "text-[#2563eb]";
    case "Regional": return "text-[#7c3aed]";
    case "Resultats non trouves sur la FFTT": return "text-[#94a3b8]";
    default: return "text-[#d97706]";
  }
}

function formatNiveauLabel(niveau: string): string {
  switch (niveau) {
    case "National": return "National";
    case "Regional": return "Régional";
    case "Departemental": return "Départemental";
    case "Resultats non trouves sur la FFTT": return "Résultats non trouvés sur la FFTT";
    default: return niveau;
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
  if (isError) return <EmptyState message="Erreur lors du chargement des résultats" />;

  const joueurs = data ?? [];
  if (joueurs.length === 0) return <EmptyState message="Aucun résultat pour ce tour" />;

  const totalVictoires = joueurs.reduce((s, j) => s + j.victoires, 0);
  const totalDefaites = joueurs.reduce((s, j) => s + j.defaites, 0);
  const bestBilan = joueurs.reduce((best, j) => {
    const bilanJ = j.victoires - j.defaites;
    const bilanBest = best.victoires - best.defaites;
    return bilanJ > bilanBest ? j : best;
  });

  const grouped = groupPlayers(joueurs);

  return (
    <div className="space-y-8">
      {tourDate && (
        <p className="text-sm text-[#64748b]">Date : {tourDate}</p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <p className="text-xs text-[#64748b] mb-1">Joueurs engagés</p>
          <p className="text-3xl font-bold text-[#191c1e]" style={{ fontFamily: "Manrope, sans-serif" }}>{joueurs.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <p className="text-xs text-[#64748b] mb-1">Bilan global</p>
          <p className="text-2xl font-bold">
            <span className="text-success">{totalVictoires}V</span>
            <span className="text-[#64748b] mx-1">/</span>
            <span className="text-error">{totalDefaites}D</span>
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <p className="text-xs text-[#64748b] mb-1">Meilleur bilan</p>
          <p className="text-sm font-bold text-[#191c1e] truncate">{bestBilan.nom}</p>
          <p className="text-xs">
            <span className="text-success">{bestBilan.victoires}V</span>
            <span className="text-[#64748b] mx-0.5">-</span>
            <span className="text-error">{bestBilan.defaites}D</span>
          </p>
        </div>
      </div>

      {/* Grouped results */}
      {grouped.map((section) => (
        <div
          key={section.niveauLabel}
          className={`bg-white rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${getNiveauAccentBar(section.niveauLabel)}`}
        >
          {/* Niveau header */}
          <div className={`px-6 py-4 font-extrabold text-base ${getNiveauHeaderColor(section.niveauLabel)}`} style={{ fontFamily: "Manrope, sans-serif" }}>
            {formatNiveauLabel(section.niveauLabel)}
          </div>

          <div>
            {section.ageGroups.map((group) => (
              <div key={group.ageCategory || "uncategorized"}>
                {/* Age category header (skip if empty) */}
                {group.ageCategory && (
                  <div className="px-6 py-2 bg-[#f2f4f6]">
                    <span className="text-[11px] font-semibold text-[#737686] uppercase tracking-widest">
                      {group.ageCategory}
                    </span>
                  </div>
                )}

                {/* Players in this group */}
                {group.players.map((j, idx) => (
                  <div
                    key={`${j.licence}-${j.division}`}
                    className={`flex items-center px-5 py-3.5 cursor-pointer transition-colors hover:bg-[#eff6ff] ${
                      idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fb]"
                    }`}
                    onClick={() => j.licence && onRowClick(j.licence)}
                  >
                    {/* Level badge */}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getLevelBadgeColor(j.levelCode)} mr-3 min-w-[28px] text-center`}>
                      {j.levelCode}
                    </span>

                    {/* Name + classement inline */}
                    <span className="flex-1 text-sm">
                      <span className="font-semibold text-[#191c1e]">{j.nom}{j.prenom ? ` ${j.prenom}` : ""}</span>
                      {j.classement ? <span className="text-[#94a3b8] ml-1">({j.classement})</span> : null}
                    </span>

                    {/* Rang */}
                    <span className="w-12 flex justify-center">
                      {j.rang > 0 && (
                        j.rang <= 4
                          ? <RankCircle rank={j.rang} />
                          : <span className="text-sm text-[#64748b]">{j.rang}</span>
                      )}
                    </span>

                    {/* Bilan */}
                    <span className="w-20 text-center text-sm font-semibold">
                      <span className="text-success">{j.victoires}V</span>
                      <span className="text-[#94a3b8] mx-0.5">-</span>
                      <span className="text-error">{j.defaites}D</span>
                    </span>

                    {/* Points code */}
                    <span className="text-sm text-[#64748b] w-16 text-right">
                      {j.points || ""}
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
  const searchParams = new URLSearchParams(window.location.search);
  const tourFromUrl = searchParams.get("tour");

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
  const defaultTour = tourFromUrl ? parseInt(tourFromUrl, 10) : null;
  const [activeTour, setActiveTour] = useState<number | null>(defaultTour);

  const currentTour = activeTour ?? latestTour;
  const currentTourData = availableTours.find((t) => t.tour === currentTour);

  return (
    <div className="max-w-5xl mx-auto px-3 md:px-4 py-6 md:py-8 space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-[#191c1e]" style={{ fontFamily: "Manrope, sans-serif" }}>
          Critérium Fédéral
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
                      className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white shadow-[0_2px_8px_rgba(37,99,235,0.3)]"
                          : "bg-[#f2f4f6] text-[#505f76] hover:bg-[#e8eaed]"
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
