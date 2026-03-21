import { useParams, useNavigate } from "react-router";
import { useCriteriumDetail } from "../hooks/use-criterium.js";
import { LoadingSkeleton } from "../components/LoadingSkeleton.js";
import { EmptyState } from "../components/EmptyState.js";
import { DivisionBadge } from "../components/DivisionBadge.js";

interface Standing {
  rang: number;
  licence: string;
  nom: string;
  prenom: string;
  club: string;
  classement: string;
  points: number;
}

interface Match {
  adversaire_nom: string;
  adversaire_prenom: string;
  adversaire_classement: string;
  resultat: "V" | "D";
  points: number;
}

interface PlayerDetail {
  licence: string;
  nom: string;
  prenom: string;
  division: string;
  classement: string;
  victoires: number;
  defaites: number;
  total_points: number;
  standings: Standing[];
  matches: Match[];
}

function getPointsColor(points: number): string {
  if (points > 0) return "text-success";
  if (points < 0) return "text-error";
  return "text-text-secondary";
}

export function CriteriumDetail() {
  const { tour, licence } = useParams<{ tour: string; licence: string }>();
  const navigate = useNavigate();

  const tourNum = tour ? parseInt(tour, 10) : 1;

  const { data, isLoading, isError, error } = useCriteriumDetail(
    tourNum,
    licence ?? ""
  ) as {
    data: PlayerDetail | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate("/criterium")}
          className="text-sm text-primary cursor-pointer mb-4 hover:underline"
        >
          &larr; Criterium Tour {tour}
        </button>
        <EmptyState
          message={
            error?.message?.includes("404")
              ? "Joueur non trouve"
              : `Erreur : ${error?.message ?? "Une erreur est survenue"}`
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <EmptyState message="Joueur non trouve" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate("/criterium")}
        className="text-sm text-primary cursor-pointer hover:underline"
      >
        &larr; Criterium Tour {tour}
      </button>

      {/* Player header */}
      <div>
        <h1 className="text-xl font-bold text-[#0f172a]">
          {data.prenom} {data.nom}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <DivisionBadge division={data.division} />
          <span className="text-sm text-[#64748b]">{data.classement}</span>
        </div>
        <p className="text-2xl font-bold mt-2">
          <span className="text-success">{data.victoires}V</span>
          <span className="text-[#94a3b8] mx-1">/</span>
          <span className="text-error">{data.defaites}D</span>
        </p>
      </div>

      {/* Division standings */}
      {data.standings && data.standings.length > 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
          <h2 className="font-bold text-[#0f172a] mb-3">Classement division</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-[#64748b]">
                  <th className="text-center px-3 py-2 font-semibold">Rang</th>
                  <th className="text-left px-3 py-2 font-semibold">Joueur</th>
                  <th className="text-left px-3 py-2 font-semibold">Club</th>
                  <th className="text-center px-3 py-2 font-semibold">Clt</th>
                  <th className="text-center px-3 py-2 font-semibold">Points</th>
                </tr>
              </thead>
              <tbody>
                {data.standings.map((row) => {
                  const isPlayer = row.licence === data.licence;
                  return (
                    <tr
                      key={row.licence}
                      className={`border-b border-[#f1f5f9] ${
                        isPlayer
                          ? "bg-[#eff6ff] text-primary font-semibold"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-center">{row.rang}</td>
                      <td className="px-3 py-2">
                        {row.prenom} {row.nom}
                      </td>
                      <td className="px-3 py-2 text-[#64748b]">{row.club}</td>
                      <td className="px-3 py-2 text-center text-[#64748b]">
                        {row.classement}
                      </td>
                      <td className="px-3 py-2 text-center font-bold">
                        {row.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Matches */}
      {data.matches && data.matches.length > 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
          <h2 className="font-bold text-[#0f172a] mb-3">Parties</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-[#64748b]">
                  <th className="text-left px-3 py-2 font-semibold">Adversaire</th>
                  <th className="text-center px-3 py-2 font-semibold">Classement</th>
                  <th className="text-center px-3 py-2 font-semibold">Res.</th>
                  <th className="text-center px-3 py-2 font-semibold">Points</th>
                </tr>
              </thead>
              <tbody>
                {data.matches.map((match, idx) => (
                  <tr key={idx} className="border-b border-[#f1f5f9]">
                    <td className="px-3 py-2 text-[#0f172a]">
                      {match.adversaire_prenom} {match.adversaire_nom}
                    </td>
                    <td className="px-3 py-2 text-center text-[#64748b]">
                      {match.adversaire_classement}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`font-bold ${
                          match.resultat === "V" ? "text-success" : "text-error"
                        }`}
                      >
                        {match.resultat}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 text-center font-semibold ${getPointsColor(match.points)}`}
                    >
                      {match.points > 0 ? `+${match.points}` : match.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tour summary */}
          <div className="mt-4 pt-3 border-t border-[#e2e8f0] flex justify-end">
            <span className="text-sm text-[#64748b]">
              Total points :{" "}
              <span
                className={`font-bold ${getPointsColor(data.total_points)}`}
              >
                {data.total_points > 0
                  ? `+${data.total_points}`
                  : data.total_points}
              </span>
            </span>
          </div>
        </div>
      )}

      {(!data.standings || data.standings.length === 0) &&
        (!data.matches || data.matches.length === 0) && (
          <EmptyState message="Aucune donnee disponible pour ce joueur" />
        )}
    </div>
  );
}
