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
  detail_equa: string | null;
  detail_equb: string | null;
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
  fontenayIsSideA,
  isFontenayMatch,
  equipeAName,
  equipeBName,
}: {
  equipeId: string;
  rencId: string;
  fontenayIsSideA: boolean;
  isFontenayMatch: boolean;
  equipeAName: string;
  equipeBName: string;
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
    return <p className="text-xs text-[#94a3b8] py-2">Détail non disponible</p>;

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e2e8f0] text-[#64748b]">
            <th className="text-left py-1 px-2">{equipeAName}</th>
            <th className="text-center py-1 px-2">Score</th>
            <th className="text-left py-1 px-2">{equipeBName}</th>
            <th className="text-right py-1 px-2">Sets</th>
          </tr>
        </thead>
        <tbody>
          {data.parties.map((partie) => (
            <tr key={partie.id} className="border-b border-[#f1f5f9]">
              <td className="py-1.5 px-2 max-w-[200px]">
                <div className="truncate font-medium" title={partie.joueur_a}>{partie.joueur_a}</div>
                {partie.classement_a && partie.classement_a.trim() !== "" && (
                  <span className="text-xs text-[#94a3b8]">({partie.classement_a})</span>
                )}
              </td>
              <td className="py-1.5 px-2 text-center whitespace-nowrap">
                {isFontenayMatch ? (
                  <ScoreBadge
                    scoreA={partie.score_a}
                    scoreB={partie.score_b}
                    isVictory={fontenayIsSideA ? partie.score_a > partie.score_b : partie.score_b > partie.score_a}
                  />
                ) : (
                  <span className="text-sm font-semibold text-[#64748b]">{partie.score_a} - {partie.score_b}</span>
                )}
              </td>
              <td className="py-1.5 px-2 max-w-[200px]">
                <div className="truncate font-medium" title={partie.joueur_b}>{partie.joueur_b}</div>
                {partie.classement_b && partie.classement_b.trim() !== "" && (
                  <span className="text-xs text-[#94a3b8]">({partie.classement_b})</span>
                )}
              </td>
              <td className="py-1.5 px-2 text-right text-xs text-[#64748b] whitespace-nowrap">
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
          &larr; Toutes les équipes
        </button>
        <EmptyState
          message={
            is404
              ? "Équipe non trouvée"
              : `Erreur : ${error?.message ?? "Une erreur est survenue"}`
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <EmptyState message="Équipe non trouvée" />
      </div>
    );
  }

  const { equipe, classement, rencontres } = data;

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-4 py-6 md:py-8 space-y-6">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate("/equipes")}
        className="text-sm text-primary cursor-pointer hover:underline"
      >
        &larr; Toutes les équipes
      </button>

      {/* Team header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#0f172a]">{equipe.lib_equipe}</h1>
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
                  <th className="text-center px-2 md:px-3 py-2 font-semibold">#</th>
                  <th className="text-left px-2 md:px-3 py-2 font-semibold">Équipe</th>
                  <th className="text-center px-2 md:px-3 py-2 font-semibold">J</th>
                  <th className="text-center px-2 md:px-3 py-2 font-semibold">V</th>
                  <th className="hidden md:table-cell text-center px-2 md:px-3 py-2 font-semibold">N</th>
                  <th className="text-center px-2 md:px-3 py-2 font-semibold">D</th>
                  <th className="text-center px-2 md:px-3 py-2 font-semibold">Pts</th>
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
                        <td className="px-2 md:px-3 py-2 md:py-3 text-center">{row.position}</td>
                        <td className="px-2 md:px-3 py-2 md:py-3">{row.nom_equipe}</td>
                        <td className="px-2 md:px-3 py-2 md:py-3 text-center">{row.joue}</td>
                        <td className="px-2 md:px-3 py-2 md:py-3 text-center">{row.victoires}</td>
                        <td className="hidden md:table-cell px-2 md:px-3 py-2 md:py-3 text-center">{row.nuls}</td>
                        <td className="px-2 md:px-3 py-2 md:py-3 text-center">{row.defaites}</td>
                        <td className="px-2 md:px-3 py-2 md:py-3 text-center font-bold">{row.points}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Matches grouped by journee */}
      {rencontres.length > 0 && (() => {
        // Extract journee from libelle (e.g., "Poule 4 - tour n°1 du 06/02/2026" → "tour 1")
        function extractJournee(libelle: string): string {
          // Handle broken encoding: n°, n�, nÂ°
          const match = libelle.match(/tour\s*n?[°�Â°]?\s*(\d+)/i);
          return match ? `Journée ${match[1]}` : libelle.split(" du ")[0]?.replace(/[�Â°]/g, "°") ?? libelle;
        }
        function extractDate(libelle: string): string {
          const match = libelle.match(/(\d{2}\/\d{2}\/\d{4})/);
          return match ? match[1]! : "";
        }
        function isFontenayMatch(renc: Rencontre): boolean {
          return renc.equipe_a.toUpperCase().includes("FONTENAY") || renc.equipe_b.toUpperCase().includes("FONTENAY");
        }

        // Group by journee
        const journeeMap = new Map<string, { date: string; matches: Rencontre[] }>();
        for (const renc of rencontres) {
          const key = extractJournee(renc.libelle);
          if (!journeeMap.has(key)) {
            journeeMap.set(key, { date: extractDate(renc.libelle), matches: [] });
          }
          journeeMap.get(key)!.matches.push(renc);
        }

        // Sort journees by date
        const journees = Array.from(journeeMap.entries()).sort((a, b) => {
          const da = a[1].date.split("/").reverse().join("") || "0";
          const db = b[1].date.split("/").reverse().join("") || "0";
          return da.localeCompare(db);
        });

        return (
          <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[rgba(67,70,85,0.08)]">
              <h2 className="font-extrabold text-[#191c1e]" style={{ fontFamily: "Manrope, sans-serif" }}>Rencontres</h2>
            </div>

            {journees.map(([journee, { date, matches }]) => {
              // Sort: FONTENAY match first
              const sorted = matches.slice().sort((a, b) => {
                const aF = isFontenayMatch(a) ? 0 : 1;
                const bF = isFontenayMatch(b) ? 0 : 1;
                return aF - bF;
              });

              return (
                <div key={journee}>
                  {/* Journee header */}
                  <div className="px-6 py-2 bg-[#f2f4f6]">
                    <span className="text-[11px] font-semibold text-[#737686] uppercase tracking-widest">
                      {journee}
                    </span>
                    {date && <span className="text-[11px] text-[#94a3b8] ml-2">{date}</span>}
                  </div>

                  {sorted.map((renc, idx) => {
                    const played = renc.score_a !== null && renc.score_b !== null;
                    const isExpanded = expandedRencId === renc.id;
                    const isFontenay = isFontenayMatch(renc);
                    const isVictory = played
                      ? (renc.equipe_a.toUpperCase().includes("FONTENAY")
                          ? (renc.score_a ?? 0) > (renc.score_b ?? 0)
                          : (renc.score_b ?? 0) > (renc.score_a ?? 0))
                      : false;

                    return (
                      <div
                        key={renc.id}
                        className={`px-6 py-3 ${idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fb]"} ${isFontenay ? "border-l-[3px] border-l-[#2563eb]" : ""}`}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center flex-1 min-w-0">
                            <span className={`font-medium truncate flex-1 text-right ${isFontenay && renc.equipe_a.toUpperCase().includes("FONTENAY") ? "text-[#2563eb] font-semibold" : "text-[#191c1e]"}`}>
                              {renc.equipe_a}
                            </span>
                            <span className="mx-3 flex-shrink-0">
                              {played ? (
                                isFontenay ? (
                                  <ScoreBadge
                                    scoreA={renc.score_a!}
                                    scoreB={renc.score_b!}
                                    isVictory={isVictory}
                                  />
                                ) : (
                                  <span className="text-sm font-semibold text-[#64748b]">{renc.score_a} - {renc.score_b}</span>
                                )
                              ) : (
                                <span className="text-[#94a3b8] text-sm">vs</span>
                              )}
                            </span>
                            <span className={`font-medium truncate flex-1 ${isFontenay && renc.equipe_b.toUpperCase().includes("FONTENAY") ? "text-[#2563eb] font-semibold" : "text-[#191c1e]"}`}>
                              {renc.equipe_b}
                            </span>
                          </div>
                          {played && (
                            <button
                              onClick={() => setExpandedRencId(isExpanded ? null : renc.id)}
                              className="text-xs text-primary hover:underline whitespace-nowrap cursor-pointer"
                            >
                              {isExpanded ? "Masquer" : "Détail →"}
                            </button>
                          )}
                        </div>

                        {isExpanded && id && (
                          <MatchDetail
                            equipeId={id}
                            rencId={String(renc.id)}
                            fontenayIsSideA={(renc.detail_equa ?? renc.equipe_a).toUpperCase().includes("FONTENAY")}
                            isFontenayMatch={isFontenay}
                            equipeAName={renc.detail_equa ?? renc.equipe_a}
                            equipeBName={renc.detail_equb ?? renc.equipe_b}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}

      {rencontres.length === 0 && classement.length === 0 && (
        <EmptyState message="Aucune donnée disponible pour cette équipe" />
      )}
    </div>
  );
}
