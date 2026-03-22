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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(`/criterium?tour=${tour}`)}
          className="text-sm text-primary cursor-pointer mb-4 hover:underline"
        >
          &larr; Critérium Tour {tour}
        </button>
        <EmptyState
          message={
            error?.message?.includes("404")
              ? "Joueur non trouvé"
              : `Erreur : ${error?.message ?? "Une erreur est survenue"}`
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <EmptyState message="Joueur non trouvé" />
      </div>
    );
  }

  const { player, divisionStandings, matches } = data;

  const victoires = matches.filter((m) => m.victoire).length;
  const defaites = matches.filter((m) => !m.victoire).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate(`/criterium?tour=${tour}`)}
        className="text-sm text-primary cursor-pointer hover:underline"
      >
        &larr; Critérium Tour {tour}
      </button>

      {/* Player header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e]" style={{ fontFamily: "Manrope, sans-serif" }}>
          {player.nom}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <DivisionBadge division={player.division} />
          <span className="text-sm text-[#64748b]">{player.classement}</span>
        </div>
        <p className="text-3xl font-extrabold mt-3" style={{ fontFamily: "Manrope, sans-serif" }}>
          <span className="text-success">{victoires}V</span>
          <span className="text-[#94a3b8] mx-1">/</span>
          <span className="text-error">{defaites}D</span>
        </p>
      </div>

      {/* Division standings */}
      {divisionStandings && divisionStandings.length > 0 && (
        <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[rgba(67,70,85,0.08)]">
            <h2 className="font-extrabold text-[#191c1e]" style={{ fontFamily: "Manrope, sans-serif" }}>Classement division</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f2f4f6] text-[#64748b]">
                  <th className="text-center px-4 py-3 font-semibold text-[11px] uppercase tracking-widest">Rang</th>
                  <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-widest">Joueur</th>
                  <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-widest">Club</th>
                  <th className="text-center px-4 py-3 font-semibold text-[11px] uppercase tracking-widest">Clt</th>
                  <th className="text-center px-4 py-3 font-semibold text-[11px] uppercase tracking-widest">Points</th>
                </tr>
              </thead>
              <tbody>
                {divisionStandings.map((row, idx) => {
                  const isPlayer = row.licence === player.licence;
                  return (
                    <tr
                      key={row.licence ?? idx}
                      className={`transition-colors ${
                        isPlayer
                          ? "bg-[#eff6ff] text-primary font-semibold"
                          : idx % 2 === 0 ? "bg-[#f7f9fb]" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3 text-center">{row.rang}</td>
                      <td className="px-4 py-3 font-medium text-[#191c1e]">{row.nom}</td>
                      <td className="px-4 py-3 text-[#64748b]">{row.club}</td>
                      <td className="px-4 py-3 text-center text-[#64748b]">
                        {row.classement}
                      </td>
                      <td className="px-4 py-3 text-center font-bold">
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
          <div className="space-y-6">
            {/* Pool matches */}
            {poolMatches.length > 0 && (
              <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[rgba(67,70,85,0.08)] flex items-center justify-between">
                  <h2 className="font-extrabold text-[#191c1e]" style={{ fontFamily: "Manrope, sans-serif" }}>
                    {elimMatches.length > 0 ? "Matchs de poule" : "Matchs"}
                  </h2>
                  <div className="text-sm">
                    <span className="text-success font-semibold">{poolV}V</span>
                    <span className="text-[#94a3b8] mx-1">-</span>
                    <span className="text-error font-semibold">{poolD}D</span>
                    <span className="text-[#94a3b8] mx-2">|</span>
                    <span className={`font-semibold ${poolPoints >= 0 ? "text-success" : "text-error"}`}>
                      {poolPoints > 0 ? "+" : ""}{poolPoints.toFixed(1)} pts
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#f2f4f6] text-[#64748b]">
                        <th className="text-center px-4 py-3 font-semibold text-[11px] uppercase tracking-widest w-12">Res.</th>
                        <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-widest">Adversaire</th>
                        <th className="text-center px-4 py-3 font-semibold text-[11px] uppercase tracking-widest">Clt</th>
                        <th className="text-center px-4 py-3 font-semibold text-[11px] uppercase tracking-widest">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poolMatches.map((match, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-[#f7f9fb]" : "bg-white"}>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`font-bold text-base ${match.victoire ? "text-success" : "text-error"}`}>
                              {match.victoire ? "V" : "D"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-[#191c1e] font-medium">{match.adversaire}</td>
                          <td className="px-4 py-3.5 text-center text-[#64748b]">
                            {match.adversaireClassement || ""}
                          </td>
                          <td className={`px-4 py-3.5 text-center font-semibold ${(match.pointsResultat ?? 0) >= 0 ? "text-success" : "text-error"}`}>
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
              <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[rgba(67,70,85,0.08)] flex items-center justify-between">
                  <h2 className="font-extrabold text-[#191c1e]" style={{ fontFamily: "Manrope, sans-serif" }}>Phases finales</h2>
                  <div className="text-sm">
                    <span className="text-success font-semibold">{elimV}V</span>
                    <span className="text-[#94a3b8] mx-1">-</span>
                    <span className="text-error font-semibold">{elimD}D</span>
                    <span className="text-[#94a3b8] mx-2">|</span>
                    <span className={`font-semibold ${elimPoints >= 0 ? "text-success" : "text-error"}`}>
                      {elimPoints > 0 ? "+" : ""}{elimPoints.toFixed(1)} pts
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#f2f4f6] text-[#64748b]">
                        <th className="text-center px-4 py-3 font-semibold text-[11px] uppercase tracking-widest w-12">Res.</th>
                        <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-widest">Phase</th>
                        <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-widest">Adversaire</th>
                        <th className="text-center px-4 py-3 font-semibold text-[11px] uppercase tracking-widest">Clt</th>
                        <th className="text-center px-4 py-3 font-semibold text-[11px] uppercase tracking-widest">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {elimMatches.map((match, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-[#f7f9fb]" : "bg-white"}>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`font-bold text-base ${match.victoire ? "text-success" : "text-error"}`}>
                              {match.victoire ? "V" : "D"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-[#64748b]">{match.libelle}</td>
                          <td className="px-4 py-3.5 text-[#191c1e] font-medium">{match.adversaire}</td>
                          <td className="px-4 py-3.5 text-center text-[#64748b]">
                            {match.adversaireClassement || ""}
                          </td>
                          <td className={`px-4 py-3.5 text-center font-semibold ${(match.pointsResultat ?? 0) >= 0 ? "text-success" : "text-error"}`}>
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
          <EmptyState message="Aucune donnée disponible pour ce joueur" />
        )}
    </div>
  );
}
