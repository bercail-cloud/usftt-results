import { useState } from "react";
import { useNavigate } from "react-router";
import { useEquipes } from "../hooks/use-equipes.js";
import { LoadingSkeleton } from "../components/LoadingSkeleton.js";
import { EmptyState } from "../components/EmptyState.js";
import { DivisionBadge } from "../components/DivisionBadge.js";
import { RankCircle } from "../components/RankCircle.js";
import { ScoreBadge } from "../components/ScoreBadge.js";

interface Rencontre {
  id: number;
  libelle: string;
  equipe_a: string;
  equipe_b: string;
  score_a: number | null;
  score_b: number | null;
  is_domicile: boolean;
  journee: number | null;
}

interface Classement {
  position: number;
  points: number;
  joue: number;
  victoires: number;
  defaites: number;
}

interface EquipeItem {
  equipe: {
    id: number;
    lib_equipe: string;
    lib_division: string;
    type_epreuve: string;
  };
  classements: Classement[];
  rencontres: Rencontre[];
}

interface EquipeGroup {
  level: string;
  equipes: EquipeItem[];
}

interface EquipesResponse {
  groups: EquipeGroup[];
  lastSync: string | null;
}

const FILTER_TABS = [
  { label: "Toutes", value: "" },
  { label: "Masculines", value: "M" },
  { label: "Feminines", value: "F" },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function getMaxJournee(equipes: EquipeItem[]): number {
  let max = 0;
  for (const item of equipes) {
    for (const r of item.rencontres) {
      if (r.journee !== null && r.journee > max) {
        max = r.journee;
      }
    }
  }
  return max;
}

function RencontreCell({
  rencontre,
}: {
  rencontre: Rencontre | undefined;
}) {
  if (!rencontre) {
    return <td className="px-3 py-2 text-xs text-[#94a3b8]">-</td>;
  }

  const played =
    rencontre.score_a !== null && rencontre.score_b !== null;
  const opponent = rencontre.is_domicile
    ? rencontre.equipe_b
    : rencontre.equipe_a;

  if (played) {
    const scoreA = rencontre.is_domicile ? rencontre.score_a! : rencontre.score_b!;
    const scoreB = rencontre.is_domicile ? rencontre.score_b! : rencontre.score_a!;
    const isVictory = scoreA > scoreB;

    return (
      <td className="px-3 py-2">
        <div className="flex flex-col items-center gap-0.5">
          <ScoreBadge scoreA={scoreA} scoreB={scoreB} isVictory={isVictory} />
          <span className="text-[10px] text-[#64748b] truncate max-w-[80px]" title={opponent}>
            {opponent}
          </span>
        </div>
      </td>
    );
  }

  return (
    <td className="px-3 py-2">
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-sm" title={rencontre.is_domicile ? "Domicile" : "Exterieur"}>
          {rencontre.is_domicile ? "🏠" : "✈️"}
        </span>
        <span className="text-[10px] text-[#64748b] truncate max-w-[80px]" title={opponent}>
          {opponent}
        </span>
      </div>
    </td>
  );
}

function EquipeGroupCard({
  group,
  onRowClick,
}: {
  group: EquipeGroup;
  onRowClick: (id: number) => void;
}) {
  const maxJournee = getMaxJournee(group.equipes);
  const journees = Array.from({ length: maxJournee }, (_, i) => i + 1);

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg p-5">
      <h3 className="font-bold text-[#0f172a] mb-3">{group.level}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e2e8f0]">
              <th className="text-left px-3 py-2 font-semibold text-[#64748b]">Equipe</th>
              <th className="text-center px-3 py-2 font-semibold text-[#64748b]">Clt</th>
              <th className="text-center px-3 py-2 font-semibold text-[#64748b]">Pts</th>
              {journees.map((j) => (
                <th key={j} className="text-center px-3 py-2 font-semibold text-[#64748b]">
                  J{j}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.equipes.map((item) => {
              const classement = item.classements[0];
              const rencontresByJournee = new Map(
                item.rencontres.map((r) => [r.journee, r])
              );

              return (
                <tr
                  key={item.equipe.id}
                  className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer transition-colors"
                  onClick={() => onRowClick(item.equipe.id)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <DivisionBadge division={item.equipe.lib_division} />
                      <span className="font-medium text-[#0f172a] whitespace-nowrap">
                        {item.equipe.lib_equipe}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center">
                      {classement ? (
                        <RankCircle rank={classement.position} />
                      ) : (
                        <span className="text-[#94a3b8]">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-[#0f172a]">
                    {classement ? classement.points : "-"}
                  </td>
                  {journees.map((j) => (
                    <RencontreCell
                      key={j}
                      rencontre={rencontresByJournee.get(j)}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EquipesOverview() {
  const [activeFilter, setActiveFilter] = useState("");
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useEquipes(
    activeFilter || undefined
  ) as {
    data: EquipesResponse | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };

  const groups = data?.groups ?? [];
  const totalEquipes = groups.reduce((sum, g) => sum + g.equipes.length, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a]">
          Resultats par equipes
        </h1>
        {data?.lastSync && (
          <p className="text-xs text-[#94a3b8] mt-1">
            Derniere mise a jour : {formatDate(data.lastSync)}
          </p>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#0f172a] text-white"
                  : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Phase indicator */}
      {!isLoading && !isError && groups.length > 0 && (
        <div className="text-sm">
          <span className="font-bold text-[#0f172a]">Phase 2</span>{" "}
          <span className="text-[#94a3b8]">({totalEquipes} equipes)</span>
        </div>
      )}

      {/* Content */}
      {isLoading && <LoadingSkeleton lines={5} />}

      {isError && (
        <EmptyState
          message={
            error?.message
              ? `Erreur : ${error.message}`
              : "Une erreur est survenue lors du chargement"
          }
        />
      )}

      {!isLoading && !isError && groups.length === 0 && (
        <EmptyState message="Aucune equipe trouvee" />
      )}

      {!isLoading && !isError && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((group) => (
            <EquipeGroupCard
              key={group.level}
              group={group}
              onRowClick={(id) => navigate(`/equipes/${id}`)}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      {!isLoading && !isError && groups.length > 0 && (
        <p className="text-xs text-[#94a3b8]">
          🏠 Domicile &nbsp;·&nbsp; ✈️ Exterieur
        </p>
      )}
    </div>
  );
}
