import { useState } from "react";
import { useNavigate } from "react-router";
import { useJoueurs } from "../hooks/use-joueurs.js";
import { LoadingSkeleton } from "../components/LoadingSkeleton.js";
import { EmptyState } from "../components/EmptyState.js";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface Joueur {
  licence: string;
  nom: string;
  prenom: string;
  points_officiels: number | null;
  points_mensuels: number | null;
  ancien_points_mensuels: number | null;
  points_initm: number | null;
  categorie: string | null;
  type_licence: string | null;
  sexe: string | null;
  nb_matchs: number | null;
  progression_mensuelle: number | null;
}

interface JoueursResponse {
  data: Joueur[];
  lastSync: string | null;
}


// ──────────────────────────────────────────────
// Filter definitions
// ──────────────────────────────────────────────

const CATEGORIES = [
  { value: "", label: "Toutes" },
  { value: "S", label: "S" },
  { value: "J", label: "J" },
  { value: "C", label: "C" },
  { value: "M", label: "M" },
  { value: "B", label: "B" },
  { value: "P", label: "P" },
  { value: "V", label: "V" },
] as const;

const SEXES = [
  { value: "", label: "Tous" },
  { value: "M", label: "M" },
  { value: "F", label: "F" },
] as const;


const CATEGORIE_LABELS: Record<string, string> = {
  S: "Senior",
  J: "Junior",
  C: "Cadet",
  M: "Minime",
  B: "Benjamin",
  P: "Poussin",
  V: "Vétéran",
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatProgression(value: number | null): string {
  if (value === null || value === undefined) return "—";
  if (value > 0) return `+${value}`;
  return String(value);
}

function getPointsColor(points: number): string {
  if (points > 0) return "text-success";
  if (points < 0) return "text-error";
  return "text-[#737686]";
}

// ──────────────────────────────────────────────
// PillTabs component
// ──────────────────────────────────────────────

interface PillTabsProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}

function PillTabs<T extends string>({ options, value, onChange, label }: PillTabsProps<T>) {
  return (
    <div className="flex gap-2 flex-wrap" role="group" aria-label={label}>
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              isActive
                ? "bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white shadow-[0_2px_8px_rgba(37,99,235,0.3)]"
                : "bg-[#f2f4f6] text-[#505f76] hover:bg-[#e8eaed]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────
// PlayersTable component
// ──────────────────────────────────────────────

interface PlayersTableProps {
  joueurs: Joueur[];
  selectedLicence: string;
  onSelect: (licence: string) => void;
}

function PlayersTable({ joueurs, selectedLicence, onSelect }: PlayersTableProps) {
  if (joueurs.length === 0) {
    return <EmptyState message="Aucun joueur ne correspond aux filtres" />;
  }

  return (
    <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table" aria-label="Liste des joueurs">
          <thead>
            <tr className="bg-[#f2f4f6]">
              <th className="text-center px-3 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
                Cat
              </th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap">
                Nom Prénom
              </th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap">
                Mensuel
              </th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap">
                Officiel
              </th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap">
                Début saison
              </th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap">
                Progression
              </th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap">
                Matchs
              </th>
            </tr>
          </thead>
          <tbody>
            {joueurs.map((j, idx) => {
              const isSelected = j.licence === selectedLicence;
              const prog = j.progression_mensuelle ?? 0;
              return (
                <tr
                  key={j.licence}
                  onClick={() => onSelect(j.licence)}
                  className={`cursor-pointer transition-colors hover:bg-[#eff6ff] ${
                    isSelected
                      ? "bg-[#dbeafe]"
                      : idx % 2 === 0
                        ? "bg-white"
                        : "bg-[#f7f9fb]"
                  }`}
                  aria-selected={isSelected}
                >
                  <td className="px-3 py-3 text-center text-[#737686]" title={CATEGORIE_LABELS[j.categorie ?? ""] ?? ""}>
                    {j.categorie ?? "—"}
                  </td>
                  <td className={`px-5 py-3 font-semibold text-[#191c1e] whitespace-nowrap border-l-[3px] ${j.sexe === "F" ? "border-l-pink-400" : "border-l-blue-400"}`}>
                    {j.nom} {j.prenom}
                  </td>
                  <td className="px-4 py-3 text-right text-[#191c1e] font-mono tabular-nums">
                    {j.points_mensuels != null ? Math.round(j.points_mensuels) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[#191c1e] font-mono tabular-nums">
                    {j.points_officiels ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[#737686] font-mono tabular-nums">
                    {j.points_initm ?? "—"}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold font-mono tabular-nums ${getPointsColor(prog)}`}>
                    {formatProgression(j.progression_mensuelle)}
                  </td>
                  <td className="px-4 py-3 text-right text-[#737686]">
                    {j.nb_matchs ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────

export function Progression() {
  const navigate = useNavigate();
  const [filterCategorie, setFilterCategorie] = useState("");
  const [filterSexe, setFilterSexe] = useState("");

  const { data: joueursData, isLoading: joueursLoading } = useJoueurs() as {
    data: JoueursResponse | undefined;
    isLoading: boolean;
  };

  const allJoueurs = joueursData?.data ?? [];

  const filteredJoueurs = allJoueurs
    .filter((j) => {
      if (filterCategorie && j.categorie !== filterCategorie) return false;
      if (filterSexe && j.sexe !== filterSexe) return false;
      return true;
    })
    .slice()
    .sort((a, b) => (b.points_officiels ?? 0) - (a.points_officiels ?? 0));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Title */}
      <div>
        <h1
          className="text-2xl font-extrabold text-[#191c1e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Progression individuelle
        </h1>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-6 items-start">
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
              Catégorie
            </span>
            <PillTabs
              options={CATEGORIES}
              value={filterCategorie}
              onChange={setFilterCategorie}
              label="Filtrer par catégorie"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
              Sexe
            </span>
            <PillTabs
              options={SEXES}
              value={filterSexe}
              onChange={setFilterSexe}
              label="Filtrer par sexe"
            />
          </div>
        </div>
      </div>

      {/* Players overview table */}
      {joueursLoading ? (
        <LoadingSkeleton lines={8} />
      ) : (
        <PlayersTable
          joueurs={filteredJoueurs}
          selectedLicence=""
          onSelect={(licence) => navigate(`/progression/${licence}`)}
        />
      )}
    </div>
  );
}
