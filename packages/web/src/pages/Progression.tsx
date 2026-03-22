import { useState } from "react";
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
  lastSync: string | null;
}

interface ProgressionResponse {
  data: ProgressionPoint[];
}

interface PartiesResponse {
  data: Partie[];
}

/**
 * Parse a date string in DD/MM/YYYY format and return a Date object.
 * Returns an invalid Date if parsing fails.
 */
function parseDDMMYYYY(dateStr: string): Date {
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10) - 1; // months are 0-indexed
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

/**
 * Format chart X-axis label from "Saison 2004 / 2005" + phase 1 → "04/05 P1"
 */
function formatChartLabel(point: ProgressionPoint): string {
  // Expected saison format: "Saison 2004 / 2005" or "2004/2005" or similar
  const yearMatch = point.saison.match(/(\d{4})\s*[/\-]\s*(\d{4})/);
  if (yearMatch) {
    const startYear = yearMatch[1]!.slice(2); // last 2 digits
    const endYear = yearMatch[2]!.slice(2);
    return `${startYear}/${endYear} P${point.phase}`;
  }
  // Fallback: keep original but compact
  return `${point.saison} P${point.phase}`;
}

export function Progression() {
  const [selectedLicence, setSelectedLicence] = useState("");

  const { data: joueursData, isLoading: joueursLoading } = useJoueurs() as {
    data: JoueursResponse | undefined;
    isLoading: boolean;
  };

  const { data: progressionData, isLoading: progressionLoading } =
    useJoueurProgression(selectedLicence) as {
      data: ProgressionResponse | undefined;
      isLoading: boolean;
    };

  const { data: partiesData, isLoading: partiesLoading } =
    useJoueurParties(selectedLicence) as {
      data: PartiesResponse | undefined;
      isLoading: boolean;
    };

  const joueurs = joueursData?.data ?? [];
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Title */}
      <div>
        <h1
          className="text-2xl font-extrabold text-[#191c1e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Progression individuelle
        </h1>
      </div>

      {/* Player selector */}
      <div>
        {joueursLoading ? (
          <LoadingSkeleton lines={1} />
        ) : (
          <div className="relative inline-flex items-center w-full sm:w-80">
            <select
              value={selectedLicence}
              onChange={(e) => setSelectedLicence(e.target.value)}
              className="w-full appearance-none bg-white border border-[#dde1e7] rounded-xl px-4 py-2.5 pr-10 text-sm text-[#191c1e] shadow-[0_2px_12px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-[#2563eb] cursor-pointer"
              aria-label="Sélectionner un joueur"
            >
              <option value="">Sélectionner un joueur...</option>
              {joueurs.map((j) => (
                <option key={j.licence} value={j.licence}>
                  {j.prenom} {j.nom} ({j.points_officiels ?? 0} pts)
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 text-[#737686]"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      {!selectedLicence && (
        <EmptyState message="Sélectionnez un joueur pour voir sa progression" />
      )}

      {selectedLicence && (
        <>
          {/* Chart card */}
          <div className="bg-white rounded-xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h2
              className="font-extrabold text-[#191c1e] mb-5"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Evolution des points
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
                      <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
                        Adversaire
                      </th>
                      <th className="text-center px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
                        Class.
                      </th>
                      <th className="text-center px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
                        V/D
                      </th>
                      <th className="text-center px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
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
                        <td className="px-5 py-3 font-semibold text-[#191c1e]">
                          {partie.adversaire_nom}
                        </td>
                        <td className="px-5 py-3 text-center text-[#737686]">
                          {partie.adversaire_classement}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`font-bold ${
                              partie.victoire ? "text-success" : "text-error"
                            }`}
                          >
                            {partie.victoire ? "V" : "D"}
                          </span>
                        </td>
                        <td
                          className={`px-5 py-3 text-center font-semibold ${getPointsColor(partie.points_resultat)}`}
                        >
                          {partie.points_resultat > 0
                            ? `+${partie.points_resultat}`
                            : partie.points_resultat}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
