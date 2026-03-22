import { useNavigate } from "react-router";
import { useEquipes } from "../hooks/use-equipes.js";
import { LoadingSkeleton } from "../components/LoadingSkeleton.js";
import { EmptyState } from "../components/EmptyState.js";
import { RankCircle } from "../components/RankCircle.js";
import { ScoreBadge } from "../components/ScoreBadge.js";

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

interface GenderSection {
  gender: Gender;
  levelGroups: LevelGroup[];
}

interface LevelGroup {
  level: Level;
  equipes: EnrichedEquipeItem[];
}

interface PhaseSection {
  phase: Phase;
  phaseOrder: number;
  genderSections: GenderSection[];
}

function groupEquipes(allEquipes: EquipeItem[]): PhaseSection[] {
  // Enrich items with parsed info
  const enriched: EnrichedEquipeItem[] = allEquipes.map((item) => ({
    ...item,
    parsed: parseDivision(item.equipe.lib_division),
  }));

  // Build map: phase → gender → level → items
  const phaseMap = new Map<Phase, Map<Gender, Map<Level, EnrichedEquipeItem[]>>>();

  for (const item of enriched) {
    const { phase, gender, level } = item.parsed;

    if (!phaseMap.has(phase)) {
      phaseMap.set(phase, new Map());
    }
    const genderMap = phaseMap.get(phase)!;

    if (!genderMap.has(gender)) {
      genderMap.set(gender, new Map());
    }
    const levelMap = genderMap.get(gender)!;

    if (!levelMap.has(level)) {
      levelMap.set(level, []);
    }
    levelMap.get(level)!.push(item);
  }

  const PHASE_ORDER: Record<Phase, number> = { "Phase 2": 0, "Phase 1": 1, Jeunes: 2 };
  const GENDER_ORDER: Record<Gender, number> = { Hommes: 0, Dames: 1 };

  const sections: PhaseSection[] = [];

  for (const [phase, genderMap] of phaseMap) {
    const genderSections: GenderSection[] = [];

    for (const [gender, levelMap] of genderMap) {
      const levelGroups: LevelGroup[] = Array.from(levelMap.entries())
        .sort(([a], [b]) => LEVEL_ORDER[a] - LEVEL_ORDER[b])
        .map(([level, equipes]) => ({ level, equipes }));

      genderSections.push({ gender, levelGroups });
    }

    genderSections.sort((a, b) => GENDER_ORDER[a.gender] - GENDER_ORDER[b.gender]);

    sections.push({
      phase,
      phaseOrder: PHASE_ORDER[phase],
      genderSections,
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

function getMaxJourneeForGroup(equipes: EnrichedEquipeItem[]): number {
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RencontreCell({ rencontre }: { rencontre: Rencontre | undefined }) {
  if (!rencontre) {
    return <td className="px-3 py-2 text-xs text-[#94a3b8] text-center">-</td>;
  }

  const played = rencontre.score_a !== null && rencontre.score_b !== null;
  const opponent = rencontre.is_domicile ? rencontre.equipe_b : rencontre.equipe_a;

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
          {rencontre.is_domicile ? "D" : "E"}
        </span>
        <span className="text-[10px] text-[#64748b] truncate max-w-[80px]" title={opponent}>
          {opponent}
        </span>
      </div>
    </td>
  );
}

function LevelGroupTable({
  levelGroup,
  onRowClick,
}: {
  levelGroup: LevelGroup;
  onRowClick: (id: number) => void;
}) {
  const maxJournee = getMaxJourneeForGroup(levelGroup.equipes);
  const journees = Array.from({ length: maxJournee }, (_, i) => i + 1);

  return (
    <div
      className={`bg-white rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${getLevelAccentBar(levelGroup.level)}`}
    >
      {/* Level header */}
      <div
        className={`px-6 py-3 font-extrabold text-sm ${getLevelHeaderColor(levelGroup.level)}`}
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        {levelGroup.level}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f7f9fb]">
              <th className="text-left px-5 py-2 font-semibold text-[#64748b] text-xs">Equipe</th>
              <th className="text-center px-3 py-2 font-semibold text-[#64748b] text-xs">Clt</th>
              <th className="text-center px-3 py-2 font-semibold text-[#64748b] text-xs">Pts</th>
              {journees.map((j) => (
                <th key={j} className="text-center px-3 py-2 font-semibold text-[#64748b] text-xs">
                  J{j}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levelGroup.equipes.map((item, idx) => {
              const classement = item.classements[0];
              const rencontresByJournee = new Map(
                item.rencontres.map((r) => [r.journee, r])
              );
              const badgeCode = item.parsed.badgeCode;

              return (
                <tr
                  key={item.equipe.id}
                  className={`cursor-pointer transition-colors hover:bg-[#eff6ff] ${
                    idx % 2 === 0 ? "bg-[#f7f9fb]" : "bg-white"
                  }`}
                  onClick={() => onRowClick(item.equipe.id)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[28px] text-center ${getBadgeColor(badgeCode)}`}
                      >
                        {badgeCode}
                      </span>
                      <span className="font-semibold text-[#191c1e] whitespace-nowrap">
                        {item.equipe.lib_equipe}
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

function GenderSectionView({
  genderSection,
  onRowClick,
}: {
  genderSection: GenderSection;
  onRowClick: (id: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Gender sub-header */}
      <div className="px-1">
        <span className="text-[11px] font-semibold text-[#737686] uppercase tracking-widest">
          {genderSection.gender}
        </span>
      </div>

      {genderSection.levelGroups.map((lg) => (
        <LevelGroupTable
          key={lg.level}
          levelGroup={lg}
          onRowClick={onRowClick}
        />
      ))}
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
  const totalEquipes = section.genderSections.reduce(
    (sum, gs) => sum + gs.levelGroups.reduce((s, lg) => s + lg.equipes.length, 0),
    0
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
        <span className="text-sm text-[#94a3b8]">({totalEquipes} equipes)</span>
      </div>

      {section.genderSections.map((gs) => (
        <GenderSectionView
          key={gs.gender}
          genderSection={gs}
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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      {/* Title */}
      <div>
        <h1
          className="text-2xl font-extrabold text-[#191c1e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Resultats par equipes
        </h1>
        {data?.lastSync && (
          <p className="text-xs text-[#94a3b8] mt-1">
            Derniere mise a jour : {formatDate(data.lastSync)}
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
        <EmptyState message="Aucune equipe trouvee" />
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
          D = Domicile &nbsp;&middot;&nbsp; E = Exterieur
        </p>
      )}
    </div>
  );
}
