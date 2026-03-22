import { useParams, useNavigate } from "react-router";
import { useCriteriumDetail } from "../hooks/use-criterium.js";
import { LoadingSkeleton } from "../components/LoadingSkeleton.js";
import { EmptyState } from "../components/EmptyState.js";
import { DivisionBadge } from "../components/DivisionBadge.js";

interface Player {
  licence: string;
  nom: string;
  club: string;
  classement: number;
  division: string;
  rang: number;
  points: string;
}

interface Standing {
  rang: number;
  licence: string | null;
  nom: string;
  club: string;
  classement: number;
  points: string;
}

interface Match {
  libelle: string;
  victoire: boolean;
  adversaire: string;
  adversaireClassement?: number;
  pointsResultat?: number;
  forfait: boolean;
}

interface CriteriumDetailResponse {
  player: Player;
  divisionStandings: Standing[];
  matches: Match[];
}

export function CriteriumDetail() {
  const { tour, licence } = useParams<{ tour: string; licence: string }>();
  const navigate = useNavigate();

  const tourNum = tour ? parseInt(tour, 10) : 1;

  const { data, isLoading, isError, error } = useCriteriumDetail(
    tourNum,
    licence ?? ""
  ) as {
    data: CriteriumDetailResponse | undefined;
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
          onClick={() => navigate(`/criterium?tour=${tour}`)}
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

  const { player, divisionStandings, matches } = data;

  const victoires = matches.filter((m) => m.victoire).length;
  const defaites = matches.filter((m) => !m.victoire).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate(`/criterium?tour=${tour}`)}
        className="text-sm text-primary cursor-pointer hover:underline"
      >
        &larr; Criterium Tour {tour}
      </button>

      {/* Player header */}
      <div>
        <h1 className="text-xl font-bold text-[#0f172a]">
          {player.nom}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <DivisionBadge division={player.division} />
          <span className="text-sm text-[#64748b]">{player.classement}</span>
        </div>
        <p className="text-2xl font-bold mt-2">
          <span className="text-success">{victoires}V</span>
          <span className="text-[#94a3b8] mx-1">/</span>
          <span className="text-error">{defaites}D</span>
        </p>
      </div>

      {/* Division standings */}
      {divisionStandings && divisionStandings.length > 0 && (
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
                {divisionStandings.map((row, idx) => {
                  const isPlayer = row.licence === player.licence;
                  return (
                    <tr
                      key={row.licence ?? idx}
                      className={`border-b border-[#f1f5f9] ${
                        isPlayer
                          ? "bg-[#eff6ff] text-primary font-semibold"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-center">{row.rang}</td>
                      <td className="px-3 py-2">{row.nom}</td>
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
      {matches && matches.length > 0 && (() => {
        const poolMatches = matches.filter((m) => m.libelle === "Poule");
        const elimMatches = matches.filter((m) => m.libelle !== "Poule");
        const poolV = poolMatches.filter((m) => m.victoire).length;
        const poolD = poolMatches.filter((m) => !m.victoire).length;
        const poolPoints = poolMatches.reduce((s, m) => s + (m.pointsResultat ?? 0), 0);

        return (
          <div className="space-y-4">
            {/* Pool matches */}
            {poolMatches.length > 0 && (
              <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-[#0f172a]">{elimMatches.length > 0 ? "Matchs de poule" : "Matchs"}</h2>
                  <div className="text-sm">
                    <span className="text-success font-medium">{poolV}V</span>
                    <span className="text-[#94a3b8] mx-1">-</span>
                    <span className="text-error font-medium">{poolD}D</span>
                    <span className="text-[#94a3b8] mx-2">|</span>
                    <span className={`font-medium ${poolPoints >= 0 ? "text-success" : "text-error"}`}>
                      {poolPoints > 0 ? "+" : ""}{poolPoints.toFixed(1)} pts
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] text-[#64748b]">
                        <th className="text-center px-3 py-2 font-semibold w-12">Res.</th>
                        <th className="text-left px-3 py-2 font-semibold">Adversaire</th>
                        <th className="text-center px-3 py-2 font-semibold">Clt</th>
                        <th className="text-center px-3 py-2 font-semibold">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poolMatches.map((match, idx) => (
                        <tr key={idx} className="border-b border-[#f1f5f9]">
                          <td className="px-3 py-2 text-center">
                            <span className={`font-bold ${match.victoire ? "text-success" : "text-error"}`}>
                              {match.victoire ? "V" : "D"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[#0f172a]">{match.adversaire}</td>
                          <td className="px-3 py-2 text-center text-[#64748b]">
                            {match.adversaireClassement || ""}
                          </td>
                          <td className={`px-3 py-2 text-center font-medium ${(match.pointsResultat ?? 0) >= 0 ? "text-success" : "text-error"}`}>
                            {(match.pointsResultat ?? 0) > 0 ? "+" : ""}{match.pointsResultat?.toFixed(1) ?? ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Elimination matches */}
            {elimMatches.length > 0 && (() => {
              const elimV = elimMatches.filter((m) => m.victoire).length;
              const elimD = elimMatches.filter((m) => !m.victoire).length;
              const elimPoints = elimMatches.reduce((s, m) => s + (m.pointsResultat ?? 0), 0);
              return (
              <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-[#0f172a]">Phases finales</h2>
                  <div className="text-sm">
                    <span className="text-success font-medium">{elimV}V</span>
                    <span className="text-[#94a3b8] mx-1">-</span>
                    <span className="text-error font-medium">{elimD}D</span>
                    <span className="text-[#94a3b8] mx-2">|</span>
                    <span className={`font-medium ${elimPoints >= 0 ? "text-success" : "text-error"}`}>
                      {elimPoints > 0 ? "+" : ""}{elimPoints.toFixed(1)} pts
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] text-[#64748b]">
                        <th className="text-center px-3 py-2 font-semibold w-12">Res.</th>
                        <th className="text-left px-3 py-2 font-semibold">Phase</th>
                        <th className="text-left px-3 py-2 font-semibold">Adversaire</th>
                        <th className="text-center px-3 py-2 font-semibold">Clt</th>
                        <th className="text-center px-3 py-2 font-semibold">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {elimMatches.map((match, idx) => (
                        <tr key={idx} className="border-b border-[#f1f5f9]">
                          <td className="px-3 py-2 text-center">
                            <span className={`font-bold ${match.victoire ? "text-success" : "text-error"}`}>
                              {match.victoire ? "V" : "D"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[#64748b]">{match.libelle}</td>
                          <td className="px-3 py-2 text-[#0f172a]">{match.adversaire}</td>
                          <td className="px-3 py-2 text-center text-[#64748b]">
                            {match.adversaireClassement || ""}
                          </td>
                          <td className={`px-3 py-2 text-center font-medium ${(match.pointsResultat ?? 0) >= 0 ? "text-success" : "text-error"}`}>
                            {(match.pointsResultat ?? 0) > 0 ? "+" : ""}{match.pointsResultat ? match.pointsResultat.toFixed(1) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })()}
          </div>
        );
      })()}

      {(!divisionStandings || divisionStandings.length === 0) &&
        (!matches || matches.length === 0) && (
          <EmptyState message="Aucune donnee disponible pour ce joueur" />
        )}
    </div>
  );
}
