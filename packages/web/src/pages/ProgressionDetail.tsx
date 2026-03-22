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
import { useJoueurs, useJoueurProgression, useJoueurParties } from "../hooks/use-joueurs.js";
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

function getPointsColor(points: number): string {
  if (points > 0) return "text-success";
  if (points < 0) return "text-error";
  return "text-[#737686]";
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
        onClick={() => navigate("/progression")}
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f2f4f6]">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
                    Adversaire
                  </th>
                  <th className="text-center px-3 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
                    Clt
                  </th>
                  <th className="text-center px-3 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
                    Rés.
                  </th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedParties.map((partie, idx) => (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fb]"}
                  >
                    <td className="px-5 py-3 text-[#737686] whitespace-nowrap">
                      {formatDate(partie.date_partie)}
                    </td>
                    <td className="px-4 py-3 text-[#191c1e] font-medium">
                      {partie.adversaire_nom}
                    </td>
                    <td className="px-3 py-3 text-center text-[#737686]">
                      {partie.adversaire_classement}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`font-bold text-base ${
                          partie.victoire ? "text-success" : "text-error"
                        }`}
                      >
                        {partie.victoire ? "V" : "D"}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-semibold ${getPointsColor(partie.points_resultat)}`}
                    >
                      {partie.points_resultat > 0 ? "+" : ""}
                      {partie.points_resultat}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
