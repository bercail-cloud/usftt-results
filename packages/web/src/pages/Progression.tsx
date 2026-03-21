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
  points: number;
}

interface ProgressionPoint {
  saison: string;
  phase: string;
  points: number;
}

interface Partie {
  date: string;
  adversaire_nom: string;
  adversaire_prenom: string;
  adversaire_classement: string;
  resultat: "V" | "D";
  points: number;
}

interface JoueursResponse {
  joueurs: Joueur[];
}

interface ProgressionResponse {
  progression: ProgressionPoint[];
}

interface PartiesResponse {
  parties: Partie[];
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getPointsColor(points: number): string {
  if (points > 0) return "text-success";
  if (points < 0) return "text-error";
  return "text-text-secondary";
}

function formatChartLabel(point: ProgressionPoint): string {
  return `${point.saison} ${point.phase}`;
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

  const joueurs = joueursData?.joueurs ?? [];
  const progression = progressionData?.progression ?? [];
  const parties = partiesData?.parties ?? [];

  const chartData = progression.map((p) => ({
    label: formatChartLabel(p),
    points: p.points,
  }));

  const sortedParties = parties
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a]">
          Progression individuelle
        </h1>
      </div>

      {/* Player selector */}
      <div>
        {joueursLoading ? (
          <LoadingSkeleton lines={1} />
        ) : (
          <select
            value={selectedLicence}
            onChange={(e) => setSelectedLicence(e.target.value)}
            className="w-full sm:w-auto border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Selectionner un joueur"
          >
            <option value="">-- Selectionner un joueur --</option>
            {joueurs.map((j) => (
              <option key={j.licence} value={j.licence}>
                {j.prenom} {j.nom} ({j.points} pts)
              </option>
            ))}
          </select>
        )}
      </div>

      {!selectedLicence && (
        <EmptyState message="Selectionnez un joueur pour voir sa progression" />
      )}

      {selectedLicence && (
        <>
          {/* Chart */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
            <h2 className="font-bold text-[#0f172a] mb-4">Evolution des points</h2>
            {progressionLoading ? (
              <LoadingSkeleton lines={4} />
            ) : progression.length === 0 ? (
              <EmptyState message="Aucune donnee de progression disponible" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [value, "Points"]}
                    contentStyle={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="points"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ fill: "#2563eb", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Matches table */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
            <h2 className="font-bold text-[#0f172a] mb-3">Parties</h2>
            {partiesLoading ? (
              <LoadingSkeleton lines={5} />
            ) : sortedParties.length === 0 ? (
              <EmptyState message="Aucune partie disponible" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] text-[#64748b]">
                      <th className="text-left px-3 py-2 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Adversaire</th>
                      <th className="text-center px-3 py-2 font-semibold">Classement</th>
                      <th className="text-center px-3 py-2 font-semibold">Res.</th>
                      <th className="text-center px-3 py-2 font-semibold">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedParties.map((partie, idx) => (
                      <tr key={idx} className="border-b border-[#f1f5f9]">
                        <td className="px-3 py-2 text-[#64748b] whitespace-nowrap">
                          {formatDate(partie.date)}
                        </td>
                        <td className="px-3 py-2 text-[#0f172a]">
                          {partie.adversaire_prenom} {partie.adversaire_nom}
                        </td>
                        <td className="px-3 py-2 text-center text-[#64748b]">
                          {partie.adversaire_classement}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`font-bold ${
                              partie.resultat === "V"
                                ? "text-success"
                                : "text-error"
                            }`}
                          >
                            {partie.resultat}
                          </span>
                        </td>
                        <td
                          className={`px-3 py-2 text-center font-semibold ${getPointsColor(partie.points)}`}
                        >
                          {partie.points > 0
                            ? `+${partie.points}`
                            : partie.points}
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
