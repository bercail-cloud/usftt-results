import { useParams, useNavigate } from "react-router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useJoueurs, useJoueurProgression, useJoueurParties, useJoueurEquipes } from "../hooks/use-joueurs.js";
import { LoadingSkeleton } from "../components/LoadingSkeleton.js";
import { EmptyState } from "../components/EmptyState.js";

interface Joueur {
  licence: string;
  nom: string;
  prenom: string;
  points_officiels: number | null;
  points_mensuels: number | null;
  ancien_points_mensuels: number | null;
  points_initm: number | null;
  categorie: string | null;
  sexe: string;
}

interface ProgressionPoint {
  saison: string;
  phase: number;
  points: number;
}

interface Partie {
  date_partie: string;
  adversaire_nom: string;
  adversaire_classement: number;
  adversaire_rang: string | null;
  victoire: boolean;
  points_resultat: number;
  coefficient: number;
  epreuve: string;
  epreuve_libelle: string | null;
}

function formatEpreuve(code: string): string {
  switch (code) {
    case "1": return "Équipes";
    case "2": return "Équipes";
    case "I": return "Critérium";
    case "T": return "Tournoi";
    case "+": return "Amical";
    case "#": return "Coupe";
    case "B": return "Coupe";
    case "V": return "Vétérans";
    case "H": return "Handicap";
    default: return code;
  }
}

function getEpreuveBadgeColor(code: string): string {
  switch (code) {
    case "1": case "2": return "bg-blue-50 text-blue-700";
    case "I": return "bg-purple-50 text-purple-700";
    case "T": return "bg-amber-50 text-amber-700";
    case "+": return "bg-gray-100 text-gray-600";
    case "#": case "B": return "bg-green-50 text-green-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

interface JoueursResponse {
  data: Joueur[];
}

interface ProgressionResponse {
  data: ProgressionPoint[];
}

interface PartiesResponse {
  data: Partie[];
}

function parseDDMMYYYY(dateStr: string): Date {
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10) - 1;
    const year = parseInt(parts[2]!, 10);
    return new Date(year, month, day);
  }
  return new Date(NaN);
}

function formatDate(dateStr: string): string {
  const date = parseDDMMYYYY(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}


function formatChartLabel(point: ProgressionPoint): string {
  const yearMatch = point.saison.match(/(\d{4})\s*[/-]\s*(\d{4})/);
  if (yearMatch) {
    const startYear = yearMatch[1]!.slice(2);
    const endYear = yearMatch[2]!.slice(2);
    return `${startYear}/${endYear} P${point.phase}`;
  }
  return `${point.saison} P${point.phase}`;
}

export function ProgressionDetail() {
  const { licence } = useParams<{ licence: string }>();
  const navigate = useNavigate();

  const { data: joueursData } = useJoueurs() as {
    data: JoueursResponse | undefined;
  };

  const joueur = joueursData?.data.find((j) => j.licence === licence);

  const { data: progressionData, isLoading: progressionLoading } =
    useJoueurProgression(licence ?? "") as {
      data: ProgressionResponse | undefined;
      isLoading: boolean;
    };

  const { data: partiesData, isLoading: partiesLoading } =
    useJoueurParties(licence ?? "") as {
      data: PartiesResponse | undefined;
      isLoading: boolean;
    };

  interface EquipeStats {
    lib_equipe: string;
    lib_division: string;
    victoires: number;
    defaites: number;
    total: number;
  }

  const { data: equipesData } = useJoueurEquipes(licence ?? "") as {
    data: { data: EquipeStats[] } | undefined;
  };

  const progression = progressionData?.data ?? [];
  const parties = partiesData?.data ?? [];

  // Build chart data with gap detection
  const chartData: Array<{ label: string; points: number | null }> = [];

  function extractYear(saison: string): number {
    const match = saison.match(/(\d{4})\s*[/-]\s*\d{4}/);
    return match ? parseInt(match[1]!, 10) : 0;
  }

  for (let i = 0; i < progression.length; i++) {
    const p = progression[i]!;

    // Detect gap: if previous entry exists and there's a jump > 1 year
    if (i > 0) {
      const prev = progression[i - 1]!;
      const prevYear = extractYear(prev.saison);
      const currYear = extractYear(p.saison);
      const prevPhase = prev.phase;
      const currPhase = p.phase;

      // Expected next: same year P2 or next year P1
      const expectedNextYear = prevPhase === 2 ? prevYear + 1 : prevYear;
      const expectedNextPhase = prevPhase === 2 ? 1 : 2;

      if (currYear > expectedNextYear || (currYear === expectedNextYear && currPhase > expectedNextPhase)) {
        // Insert a gap marker
        chartData.push({ label: "...", points: null });
      }
    }

    chartData.push({ label: formatChartLabel(p), points: p.points });
  }

  const sortedParties = parties
    .slice()
    .sort(
      (a, b) =>
        parseDDMMYYYY(b.date_partie).getTime() -
        parseDDMMYYYY(a.date_partie).getTime()
    );

  // Filter to current season only (July 1 to June 30)
  const currentSeasonStart = (() => {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(year, 6, 1); // July 1
  })();

  const currentSeasonParties = sortedParties.filter((p) => {
    const d = parseDDMMYYYY(p.date_partie);
    return !isNaN(d.getTime()) && d >= currentSeasonStart;
  });

  // --- Statistics computation (current season only) ---

  // Bilan général
  const totalVictoires = currentSeasonParties.filter((p) => p.victoire).length;
  const totalDefaites = currentSeasonParties.filter((p) => !p.victoire).length;
  const totalMatchs = currentSeasonParties.length;
  const pctVictoires = totalMatchs > 0 ? Math.round((totalVictoires / totalMatchs) * 100) : 0;

  // Par type de compétition
  type CompType = "Équipes" | "Critérium" | "Tournoi" | "Autres";
  const getCompType = (epreuve: string, epreuveLibelle: string | null): CompType => {
    if (epreuve === "1" || epreuve === "2") return "Équipes";
    if (epreuve === "I") return "Critérium";
    if (epreuve === "T") return "Tournoi";
    // Fallback: use epreuve_libelle for SPID-only matches (epreuve is empty)
    if (!epreuve && epreuveLibelle) {
      const lib = epreuveLibelle.toLowerCase();
      if (lib.includes("equipe") || lib.includes("équipe")) return "Équipes";
      if (lib.includes("crit")) return "Critérium";
      if (lib.includes("tournoi")) return "Tournoi";
    }
    return "Autres";
  };

  const byType: Record<CompType, { v: number; d: number; pts: number }> = {
    "Équipes": { v: 0, d: 0, pts: 0 },
    "Critérium": { v: 0, d: 0, pts: 0 },
    "Tournoi": { v: 0, d: 0, pts: 0 },
    "Autres": { v: 0, d: 0, pts: 0 },
  };

  for (const p of currentSeasonParties) {
    const t = getCompType(p.epreuve, p.epreuve_libelle);
    if (p.victoire) byType[t].v++;
    else byType[t].d++;
    byType[t].pts += p.points_resultat;
  }

  const activeTypes = (Object.entries(byType) as Array<[CompType, { v: number; d: number; pts: number }]>)
    .filter(([, stats]) => stats.v + stats.d > 0);

  // Adversaires
  const biggestUpset = (() => {
    // Victory with the most points gained
    const victories = currentSeasonParties.filter((p) => p.victoire && p.points_resultat > 0);
    if (victories.length === 0) return null;
    return victories.reduce((best, p) =>
      p.points_resultat > best.points_resultat ? p : best
    );
  })();

  const biggestUpset2 = (() => {
    // Defeat with the most points lost
    const defeats = currentSeasonParties.filter((p) => !p.victoire && p.points_resultat < 0);
    if (defeats.length === 0) return null;
    return defeats.reduce((worst, p) =>
      p.points_resultat < worst.points_resultat ? p : worst
    );
  })();

  const mostFacedOpponent = (() => {
    if (currentSeasonParties.length === 0) return null;
    const counts: Record<string, { nom: string; v: number; d: number }> = {};
    for (const p of currentSeasonParties) {
      const key = p.adversaire_nom;
      if (!counts[key]) counts[key] = { nom: p.adversaire_nom, v: 0, d: 0 };
      if (p.victoire) counts[key].v++;
      else counts[key].d++;
    }
    const sorted = Object.values(counts).sort((a, b) => (b.v + b.d) - (a.v + a.d));
    return sorted[0] ?? null;
  })();

  // Progression points
  const pointsSaison = joueur && joueur.points_mensuels != null && joueur.points_initm != null
    ? Math.round(joueur.points_mensuels - joueur.points_initm)
    : null;

  const pointsMois = joueur && joueur.points_mensuels != null && joueur.ancien_points_mensuels != null
    ? Math.round(joueur.points_mensuels - joueur.ancien_points_mensuels)
    : null;

  const playerName = joueur ? `${joueur.nom} ${joueur.prenom}` : "Joueur";
  const playerInfo = joueur
    ? `${joueur.categorie ?? ""} | ${joueur.sexe} | ${joueur.points_officiels ?? "—"} pts`
    : "";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Breadcrumb */}
      <button
        onClick={() => {
          const qs = window.location.search;
          navigate(`/progression${qs}`);
        }}
        className="text-sm text-primary cursor-pointer hover:underline"
      >
        &larr; Tous les joueurs
      </button>

      {/* Player header */}
      <div>
        <h1
          className="text-2xl font-extrabold text-[#191c1e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          {playerName}
        </h1>
        {playerInfo && (
          <p className="text-sm text-[#737686] mt-1">{playerInfo}</p>
        )}
      </div>

      {/* Equipes card */}
      {equipesData && equipesData.data.length > 0 && (
        <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-5">
            <h2
              className="font-extrabold text-[#191c1e]"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Équipes
            </h2>
          </div>
          <div className="px-6 pb-5">
            <div className="space-y-2">
              {equipesData.data.map((eq, idx) => {
                const phase = eq.lib_equipe.includes("Phase 2") ? "P2" : eq.lib_equipe.includes("Phase 1") ? "P1" : "";
                const teamNum = eq.lib_equipe.match(/(\d+)/)?.[1] ?? "";
                const divShort = eq.lib_division
                  .replace(/^FED_/, "")
                  .replace(/^L\d+_/, "")
                  .replace(/\s*(Phase|phase)\s*\d\s*/g, "")
                  .replace(/\s*Poule\s*\d+/g, "")
                  .trim();

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 py-2.5 px-4 rounded-lg bg-[#f7f9fb]"
                  >
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                      {phase}
                    </span>
                    <span className="font-semibold text-[#191c1e] text-sm">
                      Équipe {teamNum}
                    </span>
                    <span className="text-xs text-[#94a3b8]">{divShort}</span>
                    <span className="ml-auto text-sm font-semibold">
                      <span className="text-success">{eq.victoires}V</span>
                      <span className="text-[#94a3b8] mx-1">-</span>
                      <span className="text-error">{eq.defaites}D</span>
                    </span>
                    <span className="text-xs text-[#94a3b8]">
                      ({eq.total} matchs)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Statistics card */}
      {!partiesLoading && sortedParties.length > 0 && (
        <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
          <h2
            className="font-extrabold text-[#191c1e] mb-5"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Statistiques
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Bilan général */}
            <div className="bg-[#f7f9fb] rounded-lg p-4">
              <p className="text-xs font-semibold text-[#737686] uppercase tracking-wide mb-3">
                Bilan saison
              </p>
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-3xl font-extrabold text-success">{totalVictoires}V</span>
                <span className="text-[#94a3b8] text-lg font-semibold">-</span>
                <span className="text-3xl font-extrabold text-error">{totalDefaites}D</span>
                <span className="ml-auto text-2xl font-extrabold text-[#191c1e]">{pctVictoires}%</span>
              </div>
            </div>

            {/* Progression points */}
            <div className="bg-[#f7f9fb] rounded-lg p-4">
              <p className="text-xs font-semibold text-[#737686] uppercase tracking-wide mb-3">
                Progression
              </p>
              <div className="space-y-2">
                {pointsSaison !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#737686]">Saison</span>
                    <span className={`text-2xl font-extrabold ${pointsSaison >= 0 ? "text-success" : "text-error"}`}>
                      {pointsSaison > 0 ? "+" : ""}{pointsSaison} pts
                    </span>
                  </div>
                )}
                {pointsMois !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#737686]">Ce mois</span>
                    <span className={`text-2xl font-extrabold ${pointsMois >= 0 ? "text-success" : "text-error"}`}>
                      {pointsMois > 0 ? "+" : ""}{pointsMois} pts
                    </span>
                  </div>
                )}
                {pointsSaison === null && pointsMois === null && (
                  <p className="text-sm text-[#94a3b8]">Données non disponibles</p>
                )}
              </div>
            </div>

            {/* Par type de compétition */}
            {activeTypes.length > 0 && (
              <div className="bg-[#f7f9fb] rounded-lg p-4">
                <p className="text-xs font-semibold text-[#737686] uppercase tracking-wide mb-3">
                  Par type de compétition
                </p>
                <div className="space-y-2">
                  {activeTypes.map(([type, stats]) => (
                    <div key={type} className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#191c1e] w-24 flex-shrink-0">{type}</span>
                      <span className="text-sm">
                        <span className="text-success font-bold">{stats.v}V</span>
                        <span className="text-[#94a3b8] mx-1">-</span>
                        <span className="text-error font-bold">{stats.d}D</span>
                      </span>
                      <span className="ml-auto text-sm font-semibold">
                        <span className={stats.pts >= 0 ? "text-success" : "text-error"}>
                          {stats.pts > 0 ? "+" : ""}{Math.round(stats.pts)} pts
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Adversaires notables */}
            <div className="bg-[#f7f9fb] rounded-lg p-4">
              <p className="text-xs font-semibold text-[#737686] uppercase tracking-wide mb-3">
                Adversaires notables
              </p>
              <div className="space-y-3">
                {biggestUpset && (
                  <div>
                    <p className="text-xs text-[#94a3b8] mb-0.5">Plus grosse perf</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-success">V</span>
                      <span className="text-sm font-semibold text-[#191c1e]">{biggestUpset.adversaire_nom}</span>
                      <span className="text-xs text-[#94a3b8]">({biggestUpset.adversaire_classement || "?"})</span>
                      <span className="ml-auto text-sm font-semibold text-success">+{biggestUpset.points_resultat}</span>
                    </div>
                  </div>
                )}
                {biggestUpset2 && (
                  <div>
                    <p className="text-xs text-[#94a3b8] mb-0.5">Plus grosse contre-perf</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-error">D</span>
                      <span className="text-sm font-semibold text-[#191c1e]">{biggestUpset2.adversaire_nom}</span>
                      <span className="text-xs text-[#94a3b8]">({biggestUpset2.adversaire_classement || "?"})</span>
                      <span className="ml-auto text-sm font-semibold text-error">{biggestUpset2.points_resultat}</span>
                    </div>
                  </div>
                )}
                {mostFacedOpponent && (mostFacedOpponent.v + mostFacedOpponent.d) > 1 && (
                  <div>
                    <p className="text-xs text-[#94a3b8] mb-0.5">Adversaire le plus affronté</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#191c1e]">{mostFacedOpponent.nom}</span>
                      <span className="text-xs">
                        <span className="text-success font-bold">{mostFacedOpponent.v}V</span>
                        <span className="text-[#94a3b8] mx-1">-</span>
                        <span className="text-error font-bold">{mostFacedOpponent.d}D</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Chart card */}
      <div className="bg-white rounded-xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <h2
          className="font-extrabold text-[#191c1e] mb-5"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Évolution des points
        </h2>
        {progressionLoading ? (
          <LoadingSkeleton lines={4} />
        ) : progression.length === 0 ? (
          <EmptyState message="Aucune donnée de progression disponible" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f2f4f6" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#737686" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#737686" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number) => [value, "Points"]}
                contentStyle={{
                  background: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="points"
                stroke="#2563eb"
                strokeWidth={2}
                connectNulls={false}
                dot={{ fill: "#2563eb", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Matches table card */}
      <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-6 py-5">
          <h2
            className="font-extrabold text-[#191c1e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Parties
          </h2>
        </div>
        {partiesLoading ? (
          <div className="px-6 pb-5">
            <LoadingSkeleton lines={5} />
          </div>
        ) : sortedParties.length === 0 ? (
          <div className="px-6 pb-5">
            <EmptyState message="Aucune partie disponible" />
          </div>
        ) : (() => {
          // Group by date + epreuve
          const groups: Array<{ label: string; color: string; parties: typeof sortedParties }> = [];
          let currentKey = "";

          for (const partie of sortedParties) {
            const eprLabel = partie.epreuve_libelle
              ? partie.epreuve_libelle.replace(/^FED_/, "").replace(/^L\d+_/, "")
              : formatEpreuve(partie.epreuve);
            const key = `${partie.date_partie}|${eprLabel}`;

            if (key !== currentKey) {
              currentKey = key;
              groups.push({
                label: `${formatDate(partie.date_partie)} - ${eprLabel}`,
                color: getEpreuveBadgeColor(partie.epreuve),
                parties: [],
              });
            }
            groups[groups.length - 1]!.parties.push(partie);
          }

          return (
            <div>
              {groups.map((group, gi) => (
                <div key={gi}>
                  {/* Group header */}
                  <div className="px-6 py-2.5 bg-[#f2f4f6] border-t border-[rgba(67,70,85,0.06)]">
                    <span className="text-xs font-semibold text-[#505f76]">
                      {group.label}
                    </span>
                  </div>

                  {/* Matches */}
                  {group.parties.map((partie, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center px-6 py-3 ${idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fb]"}`}
                    >
                      {/* Points badge */}
                      {(() => {
                        const isEstimated = !partie.epreuve && partie.points_resultat !== 0;
                        const bg = partie.points_resultat > 0
                          ? "bg-green-500"
                          : partie.points_resultat < 0
                            ? "bg-red-500"
                            : "bg-[#475569]";
                        return (
                          <div
                            className={`w-14 h-8 rounded-md flex items-center justify-center font-bold text-xs text-white flex-shrink-0 ${bg} ${isEstimated ? "opacity-70" : ""}`}
                            title={isEstimated ? "Estimation (en attente de validation FFTT)" : ""}
                          >
                            {isEstimated ? "~ " : ""}{partie.points_resultat > 0 ? "+" : ""}{partie.points_resultat || "0"}
                          </div>
                        );
                      })()}

                      {/* Player info */}
                      <div className="ml-4 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary">{partie.adversaire_rang && partie.epreuve && partie.adversaire_classement >= 100 ? String(partie.adversaire_classement).slice(0, 2) : (partie.adversaire_classement || "?")}</span>
                          <span className="text-[#191c1e] font-medium">- {partie.adversaire_nom}</span>
                          {partie.adversaire_rang && (
                            <span className="text-xs text-[#94a3b8]">(N°{partie.adversaire_rang.replace(/^N/, "")})</span>
                          )}
                        </div>
                        <div className="text-xs text-[#94a3b8]">
                          Coef: {partie.coefficient || "1"}
                        </div>
                      </div>

                      {/* V/D indicator */}
                      <span className={`text-lg font-bold flex-shrink-0 ${partie.victoire ? "text-success" : "text-error"}`}>
                        {partie.victoire ? "V" : "D"}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
