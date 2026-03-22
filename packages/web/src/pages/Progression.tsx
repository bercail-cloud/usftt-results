import { useState, useRef } from "react";
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

function parseDDMMYYYY(dateStr: string): Date {
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10) - 1;
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

function formatProgression(value: number | null): string {
  if (value === null || value === undefined) return "—";
  if (value > 0) return `+${value}`;
  return String(value);
}

function formatChartLabel(point: ProgressionPoint): string {
  const yearMatch = point.saison.match(/(\d{4})\s*[/-]\s*(\d{4})/);
  if (yearMatch) {
    const startYear = yearMatch[1]!.slice(2);
    const endYear = yearMatch[2]!.slice(2);
    return `${startYear}/${endYear} P${point.phase}`;
  }
  return `${point.saison} P${point.phase}`;
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
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap">
                Nom Prénom
              </th>
              <th className="text-center px-3 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
                Cat
              </th>
              <th className="text-center px-3 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
                Sexe
              </th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap">
                Pts officiels
              </th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap">
                Pts mensuels
              </th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap">
                Pts début saison
              </th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#737686] whitespace-nowrap">
                Prog. mensuelle
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
                  <td className="px-5 py-3 font-semibold text-[#191c1e] whitespace-nowrap">
                    {j.nom} {j.prenom}
                  </td>
                  <td className="px-3 py-3 text-center text-[#737686]" title={CATEGORIE_LABELS[j.categorie ?? ""] ?? ""}>
                    {j.categorie ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-center text-[#737686]">
                    {j.sexe ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[#191c1e] font-mono tabular-nums">
                    {j.points_officiels ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[#191c1e] font-mono tabular-nums">
                    {j.points_mensuels != null ? Math.round(j.points_mensuels) : "—"}
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
// PlayerDetail component
// ──────────────────────────────────────────────

interface PlayerDetailProps {
  licence: string;
  joueur: Joueur | undefined;
}

function PlayerDetail({ licence, joueur }: PlayerDetailProps) {
  const { data: progressionData, isLoading: progressionLoading } =
    useJoueurProgression(licence) as {
      data: ProgressionResponse | undefined;
      isLoading: boolean;
    };

  const { data: partiesData, isLoading: partiesLoading } =
    useJoueurParties(licence) as {
      data: PartiesResponse | undefined;
      isLoading: boolean;
    };

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

  const playerName = joueur ? `${joueur.prenom} ${joueur.nom}` : "Joueur";

  return (
    <div className="space-y-6">
      {/* Detail header */}
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded bg-[#2563eb]" />
        <h2
          className="text-lg font-extrabold text-[#191c1e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          {playerName}
        </h2>
      </div>

      {/* Chart card */}
      <div className="bg-white rounded-xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <h3
          className="font-extrabold text-[#191c1e] mb-5"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Evolution des points
        </h3>
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
          <h3
            className="font-extrabold text-[#191c1e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Parties
          </h3>
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
    </div>
  );
}

// ──────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────

export function Progression() {
  const [selectedLicence, setSelectedLicence] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("");
  const [filterSexe, setFilterSexe] = useState("");

  const detailRef = useRef<HTMLDivElement>(null);

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

  function handlePlayerSelect(licence: string) {
    setSelectedLicence(licence);
    // Scroll to detail section after state update
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const selectedJoueur = allJoueurs.find((j) => j.licence === selectedLicence);

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
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#737686]">
              Type licence
            </span>
          </div>
        </div>
      </div>

      {/* Players overview table */}
      {joueursLoading ? (
        <LoadingSkeleton lines={8} />
      ) : (
        <PlayersTable
          joueurs={filteredJoueurs}
          selectedLicence={selectedLicence}
          onSelect={handlePlayerSelect}
        />
      )}

      {/* Player detail section */}
      {selectedLicence && (
        <div ref={detailRef} className="space-y-6 pt-2">
          <PlayerDetail licence={selectedLicence} joueur={selectedJoueur} />
        </div>
      )}
    </div>
  );
}
