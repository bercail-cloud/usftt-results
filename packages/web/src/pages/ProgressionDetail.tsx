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
  victoire: boolean;
  points_resultat: number;
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

  const chartData = progression.map((p) => ({
    label: formatChartLabel(p),
    points: p.points,
  }));

  const sortedParties = parties
    .slice()
    .sort(
      (a, b) =>
        parseDDMMYYYY(b.date_partie).getTime() -
        parseDDMMYYYY(a.date_partie).getTime()
    );

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
                  .replace(/^D\d+[-_]?/, "D")
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
                            {isEstimated ? "~" : ""}{partie.points_resultat > 0 ? "+" : ""}{partie.points_resultat || "0"}
                          </div>
                        );
                      })()}

                      {/* Player info */}
                      <div className="ml-4 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary">{partie.adversaire_classement}</span>
                          <span className="text-[#191c1e] font-medium">- {partie.adversaire_nom}</span>
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
