import { useNavigate } from "react-router";
import { useEquipes } from "../hooks/use-equipes.js";
import { LoadingSkeleton } from "../components/LoadingSkeleton.js";
import { EmptyState } from "../components/EmptyState.js";
import { RankCircle } from "../components/RankCircle.js";
import { Home, Car } from "lucide-react";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Rencontre {
  id: number;
  libelle: string;
  equipe_a: string;
  equipe_b: string;
  score_a: number | null;
  score_b: number | null;
  is_domicile: boolean;
  journee: number | null;
  date_prevue: string;
}

interface Classement {
  nom_equipe?: string;
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

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

type Phase = "Phase 2" | "Phase 1" | "Jeunes";
type Gender = "Hommes" | "Dames";
type Level = "Nationale" | "Regionale" | "Departementale" | "Jeunes";

interface ParsedDivision {
  phase: Phase;
  gender: Gender;
  level: Level;
  /** Short code for the badge, e.g. "N2", "PN", "R2", "D3", "PR", "J1" */
  badgeCode: string;
}

function parsePhase(lib: string): Phase {
  // Check for jeunes first
  if (/^J\d/i.test(lib.trim())) return "Jeunes";

  // Match "Phase 2" / "phase 2" / "Phase2" / "phase2"
  if (/[Pp]hase\s*2/.test(lib)) return "Phase 2";
  if (/[Pp]hase\s*1/.test(lib)) return "Phase 1";

  // Default to Phase 1
  return "Phase 1";
}

function parseGender(lib: string): Gender {
  if (/[Dd]ames|[Ff][eé]minin|Feminine/i.test(lib)) return "Dames";
  return "Hommes";
}

function parseLevel(lib: string): Level {
  const trimmed = lib.trim();
  if (/^J\d/i.test(trimmed)) return "Jeunes";
  if (trimmed.startsWith("FED_")) return "Nationale";
  if (trimmed.startsWith("L08_") || trimmed.startsWith("L") && /^L\d+_/.test(trimmed)) return "Regionale";
  // D + digit, PR, Pre-Reg → Departementale
  if (/^D\d/.test(trimmed) || /^PR\b/i.test(trimmed) || /^Pre-Reg/i.test(trimmed)) return "Departementale";
  return "Departementale";
}

function extractBadgeCode(lib: string): string {
  const trimmed = lib.trim();

  // Jeunes: "J1 benjamins" → "J1"
  const jMatch = trimmed.match(/^(J\d)/i);
  if (jMatch) return jMatch[1]!.toUpperCase();

  // Nationale: "FED_Nationale 2" → "N2", "FED_Nationale 1" → "N1"
  if (trimmed.startsWith("FED_")) {
    const natMatch = trimmed.match(/Nationale\s*(\d)/i);
    if (natMatch) return `N${natMatch[1]}`;
    return "N";
  }

  // Regionale: "L08_PN" → "PN", "L08_R2" → "R2"
  if (/^L\d+_/.test(trimmed)) {
    const codeMatch = trimmed.match(/^L\d+_(\S+)/);
    if (codeMatch) return codeMatch[1]!.toUpperCase();
    return "R";
  }

  // Departementale: "D3" → "D3", "PR" → "PR", "Pre-Reg" → "PR"
  const dMatch = trimmed.match(/^(D\d+)/);
  if (dMatch) return dMatch[1]!.toUpperCase();

  if (/^Pre-Reg/i.test(trimmed)) return "PR";

  const prMatch = trimmed.match(/^(PR)\b/i);
  if (prMatch) return "PR";

  // Fallback: first token
  return trimmed.split(/\s+/)[0]?.toUpperCase() ?? "?";
}

function parseDivision(lib: string): ParsedDivision {
  const phase = parsePhase(lib);
  const level = parseLevel(lib);
  const gender: Gender = phase === "Jeunes" ? "Hommes" : parseGender(lib);
  const badgeCode = extractBadgeCode(lib);

  return { phase, gender, level, badgeCode };
}

// ---------------------------------------------------------------------------
// Grouping logic
// ---------------------------------------------------------------------------

type LevelOrder = Record<Level, number>;
const LEVEL_ORDER: LevelOrder = { Nationale: 0, Regionale: 1, Departementale: 2, Jeunes: 3 };

interface EnrichedEquipeItem extends EquipeItem {
  parsed: ParsedDivision;
}

interface LevelGroup {
  level: Level;
  equipes: EnrichedEquipeItem[];
}

interface PhaseSection {
  phase: Phase;
  phaseOrder: number;
  levelGroups: LevelGroup[];
}

/** Extract team number from lib_equipe, e.g. "FONTENAY USTT 3 - Phase 2" → 3 */
function extractTeamNumber(libEquipe: string): number {
  const match = libEquipe.match(/(\d+)/);
  return match ? parseInt(match[1]!, 10) : 999;
}

/** Truncate opponent name: "FUTURO VALVERT TT 1" → "FUTURO VAL." */
function truncateOpponent(name: string): string {
  // Remove trailing numbers (team number) and common suffixes
  const cleaned = name.replace(/\s+\d+$/, "").replace(/\s+(TT|US|AS|USTT|ASTT|SP|ES)$/i, "");
  if (cleaned.length <= 12) return cleaned;
  return cleaned.slice(0, 11) + ".";
}

/** Format "FONTENAY USTT 3 - Phase 2" → "Équipe 3" */
function formatTeamName(libEquipe: string): string {
  const num = extractTeamNumber(libEquipe);
  return num < 999 ? `Équipe ${num}` : libEquipe;
}

/** Display level names with proper French accents */
function formatLevelName(level: Level): string {
  switch (level) {
    case "Nationale": return "Nationale";
    case "Regionale": return "Régionale";
    case "Departementale": return "Départementale";
    case "Jeunes": return "Jeunes";
  }
}

function groupEquipes(allEquipes: EquipeItem[]): PhaseSection[] {
  const enriched: EnrichedEquipeItem[] = allEquipes.map((item) => ({
    ...item,
    parsed: parseDivision(item.equipe.lib_division),
  }));

  // Build map: phase → level → items (no gender split)
  const phaseMap = new Map<Phase, Map<Level, EnrichedEquipeItem[]>>();

  for (const item of enriched) {
    const { phase, level } = item.parsed;

    if (!phaseMap.has(phase)) {
      phaseMap.set(phase, new Map());
    }
    const levelMap = phaseMap.get(phase)!;

    if (!levelMap.has(level)) {
      levelMap.set(level, []);
    }
    levelMap.get(level)!.push(item);
  }

  const PHASE_ORDER: Record<Phase, number> = { "Phase 2": 0, "Phase 1": 1, Jeunes: 2 };

  const sections: PhaseSection[] = [];

  for (const [phase, levelMap] of phaseMap) {
    const levelGroups: LevelGroup[] = Array.from(levelMap.entries())
      .sort(([a], [b]) => LEVEL_ORDER[a] - LEVEL_ORDER[b])
      .map(([level, equipes]) => ({
        level,
        equipes: equipes.sort((a, b) => {
          // Sort by badge level number (PN < R1 < R2, PR < D1 < D2...)
          // PN and PR come first (rank 0) in their level group
          function badgeRank(code: string): number {
            if (code === "PN" || code === "PR") return 0;
            const num = parseInt(code.replace(/\D/g, ""), 10);
            return Number.isNaN(num) ? 99 : num;
          }
          const aNum = badgeRank(a.parsed.badgeCode);
          const bNum = badgeRank(b.parsed.badgeCode);
          if (aNum !== bNum) return aNum - bNum;
          // Then gender: H before F
          const aGender = a.parsed.gender === "Dames" ? 1 : 0;
          const bGender = b.parsed.gender === "Dames" ? 1 : 0;
          if (aGender !== bGender) return aGender - bGender;
          // Then team number
          return extractTeamNumber(a.equipe.lib_equipe) - extractTeamNumber(b.equipe.lib_equipe);
        }),
      }));

    sections.push({
      phase,
      phaseOrder: PHASE_ORDER[phase],
      levelGroups,
    });
  }

  return sections.sort((a, b) => a.phaseOrder - b.phaseOrder);
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

function getLevelAccentBar(level: Level): string {
  switch (level) {
    case "Nationale": return "border-l-[4px] border-l-[#2563eb]";
    case "Regionale": return "border-l-[4px] border-l-[#7c3aed]";
    case "Departementale": return "border-l-[4px] border-l-[#d97706]";
    case "Jeunes": return "border-l-[4px] border-l-[#16a34a]";
  }
}

function getLevelHeaderColor(level: Level): string {
  switch (level) {
    case "Nationale": return "text-[#2563eb]";
    case "Regionale": return "text-[#7c3aed]";
    case "Departementale": return "text-[#d97706]";
    case "Jeunes": return "text-[#16a34a]";
  }
}

function getBadgeColor(code: string): string {
  const upper = code.toUpperCase();
  if (upper.startsWith("N")) return "bg-blue-100 text-blue-700";
  if (upper.startsWith("R") || upper === "PN") return "bg-purple-100 text-purple-700";
  if (upper.startsWith("J")) return "bg-green-100 text-green-700";
  return "bg-amber-100 text-amber-700";
}

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

function parseDate(d: string): number {
  if (!d) return 0;
  const parts = d.split("/");
  if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
  return 0;
}

function formatShortDate(d: string): string {
  if (!d) return "";
  const parts = d.split("/");
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return d;
}

function getUsfttMatches(rencontres: Rencontre[]): Rencontre[] {
  return rencontres
    .filter((r) => r.equipe_a.toUpperCase().includes("FONTENAY") || r.equipe_b.toUpperCase().includes("FONTENAY"))
    .sort((a, b) => parseDate(a.date_prevue) - parseDate(b.date_prevue));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MatchBadge({ r, mi, compact }: { r: Rencontre; mi: number; compact?: boolean }) {
  const isDom = r.equipe_a.toUpperCase().includes("FONTENAY");
  const opponent = isDom ? r.equipe_b : r.equipe_a;
  const shortOpp = truncateOpponent(opponent);
  const played = r.score_a !== null && r.score_b !== null;

  if (played) {
    const scoreUs = isDom ? r.score_a! : r.score_b!;
    const scoreThem = isDom ? r.score_b! : r.score_a!;
    const won = scoreUs > scoreThem;
    const draw = scoreUs === scoreThem;
    const bg = won ? "bg-green-50" : draw ? "bg-amber-50" : "bg-red-50";
    const color = won ? "text-green-700" : draw ? "text-amber-700" : "text-red-700";
    const colorSub = won ? "text-green-600" : draw ? "text-amber-600" : "text-red-600";
    return (
      <div
        key={mi}
        className={`${bg} rounded-md px-1 py-1.5 text-center`}
      >
        <div className={`text-xs font-extrabold ${color} flex items-center justify-center gap-0.5`}>
          {isDom ? <Home size={9} /> : <Car size={9} />}
          {scoreUs}-{scoreThem}
        </div>
        {!compact && <div className={`text-[7px] ${colorSub} truncate`}>{shortOpp}</div>}
      </div>
    );
  }

  // No opponent = exempt
  if (!opponent || opponent.trim() === "") {
    return (
      <div
        key={mi}
        className="bg-[#f7f9fb] rounded-md px-1 py-1.5 text-center border border-dashed border-[#e2e8f0]"
      >
        <div className="text-[9px] text-[#94a3b8] font-medium">Exempt</div>
      </div>
    );
  }

  return (
    <div
      key={mi}
      className="bg-[#f7f9fb] rounded-md px-1 py-1.5 text-center border border-dashed border-[#e2e8f0]"
    >
      <div className="text-[10px] text-[#94a3b8] flex items-center justify-center gap-0.5">
        {isDom ? <Home size={10} /> : <Car size={10} />}
        {formatShortDate(r.date_prevue)}
      </div>
      {!compact && <div className="text-[7px] text-[#94a3b8] truncate">{shortOpp}</div>}
    </div>
  );
}

function LevelGroupTable({
  levelGroup,
  onRowClick,
}: {
  levelGroup: LevelGroup;
  onRowClick: (id: number) => void;
}) {
  return (
    <div
      className={`bg-white rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${getLevelAccentBar(levelGroup.level)}`}
    >
      {/* Level header */}
      <div
        className={`px-4 md:px-6 py-3 font-extrabold text-sm ${getLevelHeaderColor(levelGroup.level)}`}
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        {formatLevelName(levelGroup.level)}
      </div>

      {/* Mobile card layout (hidden on md+) */}
      <div className="md:hidden divide-y divide-[#f1f5f9]">
        {levelGroup.equipes.map((item) => {
          const classement = item.classements.find(
            (c) => c.nom_equipe?.toUpperCase().includes("FONTENAY")
          ) ?? item.classements[0];
          const matches = getUsfttMatches(item.rencontres);
          const badgeCode = item.parsed.badgeCode;

          return (
            <div
              key={item.equipe.id}
              className="px-4 py-3 cursor-pointer hover:bg-[#eff6ff] transition-colors"
              onClick={() => onRowClick(item.equipe.id)}
            >
              {/* Card header: name + division badge + rank/points */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[28px] text-center flex-shrink-0 ${
                      item.parsed.gender === "Dames"
                        ? "bg-pink-100 text-pink-700"
                        : getBadgeColor(badgeCode)
                    }`}
                  >
                    {badgeCode}{item.parsed.gender === "Dames" ? " F" : ""}
                  </span>
                  <span className="font-semibold text-[#191c1e] truncate">
                    {formatTeamName(item.equipe.lib_equipe)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {classement ? (
                    classement.position <= 4 ? (
                      <RankCircle rank={classement.position} />
                    ) : (
                      <span className="text-sm text-[#64748b]">{classement.position}e</span>
                    )
                  ) : null}
                  {classement && (
                    <span className="text-sm font-bold text-[#191c1e]">{classement.points} pts</span>
                  )}
                </div>
              </div>

              {/* Match badges - compact on mobile, no wrap */}
              <div className="flex gap-1 overflow-x-auto">
                {matches.map((r, mi) => (
                  <MatchBadge key={mi} r={r} mi={mi} compact />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table layout (hidden on mobile) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f7f9fb]">
              <th className="text-left px-5 py-2 font-semibold text-[#64748b] text-xs">Équipe</th>
              <th className="text-center px-3 py-2 font-semibold text-[#64748b] text-xs">Clt</th>
              <th className="text-center px-3 py-2 font-semibold text-[#64748b] text-xs">Pts</th>
              <th className="text-left px-3 py-2 font-semibold text-[#64748b] text-xs">Matchs</th>
            </tr>
          </thead>
          <tbody>
            {levelGroup.equipes.map((item, idx) => {
              const classement = item.classements.find(
                (c) => c.nom_equipe?.toUpperCase().includes("FONTENAY")
              ) ?? item.classements[0];
              const matches = getUsfttMatches(item.rencontres);
              const badgeCode = item.parsed.badgeCode;

              return (
                <tr
                  key={item.equipe.id}
                  className={`cursor-pointer transition-colors hover:bg-[#eff6ff] ${
                    idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fb]"
                  }`}
                  onClick={() => onRowClick(item.equipe.id)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[28px] text-center ${
                          item.parsed.gender === "Dames"
                            ? "bg-pink-100 text-pink-700"
                            : getBadgeColor(badgeCode)
                        }`}
                      >
                        {badgeCode}{item.parsed.gender === "Dames" ? " F" : ""}
                      </span>
                      <span className="font-semibold text-[#191c1e] whitespace-nowrap">
                        {formatTeamName(item.equipe.lib_equipe)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-center">
                      {classement ? (
                        classement.position <= 4 ? (
                          <RankCircle rank={classement.position} />
                        ) : (
                          <span className="text-sm text-[#64748b]">{classement.position}</span>
                        )
                      ) : (
                        <span className="text-[#94a3b8]">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-[#191c1e]">
                    {classement ? classement.points : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="grid grid-cols-7 gap-1" style={{ minWidth: "350px" }}>
                      {matches.map((r, mi) => (
                        <MatchBadge key={mi} r={r} mi={mi} />
                      ))}
                    </div>
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

function PhaseSectionView({
  section,
  onRowClick,
}: {
  section: PhaseSection;
  onRowClick: (id: number) => void;
}) {
  const totalEquipes = section.levelGroups.reduce(
    (sum, lg) => sum + lg.equipes.length, 0
  );

  return (
    <div className="space-y-6">
      {/* Phase header */}
      <div className="flex items-baseline gap-3">
        <h2
          className="text-xl font-extrabold text-[#191c1e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          {section.phase}
        </h2>
        <span className="text-sm text-[#94a3b8]">({totalEquipes} équipes)</span>
      </div>

      {section.levelGroups.map((lg) => (
        <LevelGroupTable
          key={lg.level}
          levelGroup={lg}
          onRowClick={onRowClick}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function EquipesOverview() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useEquipes() as {
    data: EquipesResponse | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };

  // Flatten all equipes from API groups
  const allEquipes: EquipeItem[] = (data?.groups ?? []).flatMap((g) => g.equipes);
  const sections = groupEquipes(allEquipes);

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-4 py-6 md:py-8 space-y-10">
      {/* Title */}
      <div>
        <h1
          className="text-xl md:text-2xl font-extrabold text-[#191c1e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Résultats par équipes
        </h1>
        {data?.lastSync && (
          <p className="text-xs text-[#94a3b8] mt-1">
            Dernière mise à jour : {formatDate(data.lastSync)}
          </p>
        )}
      </div>

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

      {!isLoading && !isError && sections.length === 0 && (
        <EmptyState message="Aucune équipe trouvée" />
      )}

      {!isLoading && !isError && sections.length > 0 && (
        <div className="space-y-12">
          {sections.map((section) => (
            <PhaseSectionView
              key={section.phase}
              section={section}
              onRowClick={(id) => navigate(`/equipes/${id}`)}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      {!isLoading && !isError && sections.length > 0 && (
        <p className="text-xs text-[#94a3b8]">
          D = Domicile &nbsp;&middot;&nbsp; E = Extérieur
        </p>
      )}
    </div>
  );
}
