import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useEquipeDetail, useRencontreDetail } from "../hooks/use-equipes.js";
import { LoadingSkeleton } from "../components/LoadingSkeleton.js";
import { EmptyState } from "../components/EmptyState.js";
import { ScoreBadge } from "../components/ScoreBadge.js";

interface ClassementRow {
  id: number;
  equipe_id: number;
  club_numero: string;
  nom_equipe: string;
  position: number;
  points: number;
  joue: number;
  victoires: number;
  defaites: number;
  nuls: number;
  parties_gagnees: number;
  parties_perdues: number;
}

interface Rencontre {
  id: number;
  equipe_id: number;
  libelle: string;
  equipe_a: string;
  equipe_b: string;
  score_a: number | null;
  score_b: number | null;
  date_prevue: string;
  is_domicile: boolean;
}

interface Equipe {
  id: number;
  lib_equipe: string;
  lib_division: string;
  lib_epreuve: string;
  type_epreuve: string;
}

interface EquipeDetailResponse {
  equipe: Equipe;
  classement: ClassementRow[];
  rencontres: Rencontre[];
}

interface Partie {
  id: number;
  joueur_a: string;
  classement_a: string;
  joueur_b: string;
  classement_b: string;
  score_a: number;
  score_b: number;
  detail_sets: string;
}

interface RencontreDetailResponse {
  rencontre: Rencontre;
  parties: Partie[];
}

function isUsfttTeam(nomEquipe: string): boolean {
  return nomEquipe.toLowerCase().includes("usftt") ||
    nomEquipe.toLowerCase().includes("fontenay");
}

function MatchDetail({
  equipeId,
  rencId,
}: {
  equipeId: string;
  rencId: string;
}) {
  const { data, isLoading, isError } = useRencontreDetail(
    equipeId,
    String(rencId)
  ) as {
    data: RencontreDetailResponse | undefined;
    isLoading: boolean;
    isError: boolean;
  };

  if (isLoading) return <LoadingSkeleton lines={3} />;
  if (isError || !data)
    return <p className="text-xs text-[#94a3b8] py-2">Detail non disponible</p>;

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e2e8f0] text-[#64748b]">
            <th className="text-left py-1 px-2">Joueur A</th>
            <th className="text-center py-1 px-2">Score</th>
            <th className="text-left py-1 px-2">Joueur B</th>
            <th className="text-right py-1 px-2">Sets</th>
          </tr>
        </thead>
        <tbody>
          {data.parties.map((partie) => (
            <tr key={partie.id} className="border-b border-[#f1f5f9]">
              <td className="py-1.5 px-2">
                <span className="font-medium">{partie.joueur_a}</span>
                <span className="text-xs text-[#94a3b8] ml-1">
                  ({partie.classement_a})
                </span>
              </td>
              <td className="py-1.5 px-2 text-center">
                <ScoreBadge
                  scoreA={partie.score_a}
                  scoreB={partie.score_b}
                  isVictory={partie.score_a > partie.score_b}
                />
              </td>
              <td className="py-1.5 px-2">
                <span className="font-medium">{partie.joueur_b}</span>
                <span className="text-xs text-[#94a3b8] ml-1">
                  ({partie.classement_b})
                </span>
              </td>
              <td className="py-1.5 px-2 text-right text-xs text-[#64748b]">
                {partie.detail_sets}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EquipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expandedRencId, setExpandedRencId] = useState<number | null>(null);

  const { data, isLoading, isError, error } = useEquipeDetail(id ?? "") as {
    data: EquipeDetailResponse | undefined;
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
    const is404 =
      error?.message?.includes("404") ||
      error?.message?.includes("not found");
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate("/equipes")}
          className="text-sm text-primary cursor-pointer mb-4 hover:underline"
        >
          &larr; Toutes les equipes
        </button>
        <EmptyState
          message={
            is404
              ? "Equipe non trouvee"
              : `Erreur : ${error?.message ?? "Une erreur est survenue"}`
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <EmptyState message="Equipe non trouvee" />
      </div>
    );
  }

  const { equipe, classement, rencontres } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate("/equipes")}
        className="text-sm text-primary cursor-pointer hover:underline"
      >
        &larr; Toutes les equipes
      </button>

      {/* Team header */}
      <div>
        <h1 className="text-xl font-bold text-[#0f172a]">{equipe.lib_equipe}</h1>
        <p className="text-sm text-[#64748b] mt-1">{equipe.lib_division}</p>
      </div>

      {/* Pool standings */}
      {classement.length > 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
          <h2 className="font-bold text-[#0f172a] mb-3">Classement de la poule</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-[#64748b]">
                  <th className="text-center px-3 py-2 font-semibold">#</th>
                  <th className="text-left px-3 py-2 font-semibold">Equipe</th>
                  <th className="text-center px-3 py-2 font-semibold">J</th>
                  <th className="text-center px-3 py-2 font-semibold">V</th>
                  <th className="text-center px-3 py-2 font-semibold">D</th>
                  <th className="text-center px-3 py-2 font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {classement
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((row) => {
                    const highlight = isUsfttTeam(row.nom_equipe);
                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-[#f1f5f9] ${
                          highlight
                            ? "bg-[#eff6ff] text-primary font-semibold"
                            : ""
                        }`}
                      >
                        <td className="px-3 py-2 text-center">{row.position}</td>
                        <td className="px-3 py-2">{row.nom_equipe}</td>
                        <td className="px-3 py-2 text-center">{row.joue}</td>
                        <td className="px-3 py-2 text-center">{row.victoires}</td>
                        <td className="px-3 py-2 text-center">{row.defaites}</td>
                        <td className="px-3 py-2 text-center font-bold">{row.points}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Matches list */}
      {rencontres.length > 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
          <h2 className="font-bold text-[#0f172a] mb-3">Rencontres</h2>
          <div className="space-y-2">
            {rencontres.map((renc) => {
              const played =
                renc.score_a !== null && renc.score_b !== null;
              const isExpanded = expandedRencId === renc.id;
              const scoreA = renc.is_domicile ? renc.score_a : renc.score_b;
              const scoreB = renc.is_domicile ? renc.score_b : renc.score_a;
              const isVictory = played
                ? (scoreA ?? 0) > (scoreB ?? 0)
                : false;

              return (
                <div
                  key={renc.id}
                  className="border border-[#e2e8f0] rounded-lg p-3"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs text-[#94a3b8] min-w-[40px]">
                      {renc.libelle}
                    </span>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="font-medium text-[#0f172a] truncate">
                        {renc.equipe_a}
                      </span>
                      {played ? (
                        <ScoreBadge
                          scoreA={renc.score_a!}
                          scoreB={renc.score_b!}
                          isVictory={isVictory}
                        />
                      ) : (
                        <span className="text-[#94a3b8] text-sm">vs</span>
                      )}
                      <span className="font-medium text-[#0f172a] truncate">
                        {renc.equipe_b}
                      </span>
                    </div>
                    {played && (
                      <button
                        onClick={() =>
                          setExpandedRencId(isExpanded ? null : renc.id)
                        }
                        className="text-xs text-primary hover:underline whitespace-nowrap cursor-pointer"
                      >
                        {isExpanded ? "Masquer" : "Detail →"}
                      </button>
                    )}
                  </div>

                  {isExpanded && id && (
                    <MatchDetail equipeId={id} rencId={String(renc.id)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rencontres.length === 0 && classement.length === 0 && (
        <EmptyState message="Aucune donnee disponible pour cette equipe" />
      )}
    </div>
  );
}
