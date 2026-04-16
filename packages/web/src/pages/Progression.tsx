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
  progression_saison: number | null;
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
  { value: "P", label: "P" },
  { value: "B", label: "B" },
  { value: "M", label: "M" },
  { value: "C", label: "C" },
  { value: "J", label: "J" },
  { value: "S", label: "S" },
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

type SortKey = "points_mensuels" | "points_officiels" | "points_initm" | "progression_mensuelle" | "progression_saison" | "nb_matchs";
type SortDir = "asc" | "desc";

function PlayersTable({ joueurs, selectedLicence, onSelect }: PlayersTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("points_mensuels");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = joueurs.slice().sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  function SortIndicator({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-[#c3c6d7] ml-1">↕</span>;
    return <span className="text-[#2563eb] ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  if (joueurs.length === 0) {
    return <EmptyState message="Aucun joueur ne correspond aux filtres" />;
  }

  const thClass = "text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap cursor-pointer select-none hover:text-[#191c1e] transition-colors";

  return (
    <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table" aria-label="Liste des joueurs">
          <thead>
            <tr className="bg-[#f2f4f6]">
              <th className="hidden md:table-cell text-center px-3 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
                Cat
              </th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap">
                <span className="hidden md:inline">Nom Prénom</span><span className="md:hidden">Joueur</span>
              </th>
              <th className={thClass} onClick={() => handleSort("points_mensuels")}>
                Mensuel<SortIndicator col="points_mensuels" />
              </th>
              <th className={`${thClass} hidden md:table-cell`} onClick={() => handleSort("points_officiels")}>
                Officiel<SortIndicator col="points_officiels" />
              </th>
              <th className={`${thClass} hidden md:table-cell`} onClick={() => handleSort("points_initm")}>
                Début<SortIndicator col="points_initm" />
              </th>
              <th className={thClass} onClick={() => handleSort("progression_mensuelle")}>
                Prog. mois<SortIndicator col="progression_mensuelle" />
              </th>
              <th className={thClass} onClick={() => handleSort("progression_saison")}>
                Prog. saison<SortIndicator col="progression_saison" />
              </th>
              <th className={thClass} onClick={() => handleSort("nb_matchs")}>
                Matchs<SortIndicator col="nb_matchs" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((j, idx) => {
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
                  <td className={`hidden md:table-cell px-3 py-3 text-center text-[#737686] border-l-[4px] ${j.sexe === "F" ? "border-l-pink-400" : "border-l-blue-400"}`} title={CATEGORIE_LABELS[j.categorie ?? ""] ?? ""}>
                    {j.categorie ?? "—"}
                  </td>
                  <td className={`px-5 py-3 font-semibold text-[#191c1e] whitespace-nowrap border-l-[4px] md:border-l-0 ${j.sexe === "F" ? "border-l-pink-400" : "border-l-blue-400"}`}>
                    {j.nom} {j.prenom}
                    <div className="md:hidden text-[10px] text-muted font-normal">
                      {j.categorie} | {j.points_officiels} pts
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-[#191c1e] font-mono tabular-nums">
                    {j.points_mensuels != null ? Math.round(j.points_mensuels) : "—"}
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-right text-[#191c1e] font-mono tabular-nums">
                    {j.points_officiels ?? "—"}
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-right text-[#737686] font-mono tabular-nums">
                    {j.points_initm ?? "—"}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold font-mono tabular-nums ${getPointsColor(prog)}`}>
                    {formatProgression(j.progression_mensuelle)}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold font-mono tabular-nums ${getPointsColor(j.progression_saison ?? 0)}`}>
                    {formatProgression(j.progression_saison)}
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
  const searchParams = new URLSearchParams(window.location.search);

  const [filterCategorie, setFilterCategorie] = useState(searchParams.get("cat") ?? "");
  const [filterSexe, setFilterSexe] = useState(searchParams.get("sexe") ?? "");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const normalizedSearch = search
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const { data: joueursData, isLoading: joueursLoading } = useJoueurs() as {
    data: JoueursResponse | undefined;
    isLoading: boolean;
  };

  const allJoueurs = joueursData?.data ?? [];

  const filteredJoueurs = allJoueurs
    .filter((j) => {
      if (filterCategorie && !(j.categorie ?? "").startsWith(filterCategorie)) return false;
      if (filterSexe && j.sexe !== filterSexe) return false;
      if (normalizedSearch) {
        const haystack = `${j.nom} ${j.prenom}`
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => (b.points_officiels ?? 0) - (a.points_officiels ?? 0));

  return (
    <div className="max-w-5xl mx-auto px-3 md:px-4 py-6 md:py-8 space-y-8">
      {/* Title */}
      <div>
        <h1
          className="text-xl md:text-2xl font-extrabold text-[#191c1e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Progression individuelle
        </h1>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-6 items-start">
          <div className="space-y-1.5 flex-1 min-w-[200px] max-w-sm">
            <label
              htmlFor="player-search"
              className="text-[11px] font-semibold uppercase tracking-widest text-[#737686] block"
            >
              Recherche
            </label>
            <div className="relative">
              <input
                id="player-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom ou prénom…"
                className="w-full px-4 py-1.5 pr-8 rounded-full text-sm bg-[#f2f4f6] border border-transparent focus:outline-none focus:border-[#2563eb] focus:bg-white transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-[#737686] hover:bg-[#e8eaed] hover:text-[#191c1e] transition-colors"
                  aria-label="Effacer la recherche"
                >
                  ×
                </button>
              )}
            </div>
          </div>
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
        <div className="flex items-center gap-4 text-[11px] text-[#737686]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-1 h-3.5 rounded-sm bg-blue-400" aria-hidden="true" />
            Homme
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-1 h-3.5 rounded-sm bg-pink-400" aria-hidden="true" />
            Femme
          </span>
        </div>
      </div>

      {/* Players overview table */}
      {joueursLoading ? (
        <LoadingSkeleton lines={8} />
      ) : (
        <PlayersTable
          joueurs={filteredJoueurs}
          selectedLicence=""
          onSelect={(licence) => {
            const params = new URLSearchParams();
            if (filterCategorie) params.set("cat", filterCategorie);
            if (filterSexe) params.set("sexe", filterSexe);
            if (search.trim()) params.set("q", search.trim());
            const qs = params.toString();
            navigate(`/progression/${licence}${qs ? `?${qs}` : ""}`);
          }}
        />
      )}
    </div>
  );
}
