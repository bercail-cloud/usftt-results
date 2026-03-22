import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
});

function parseXml(xml: string): Record<string, unknown> {
  return parser.parse(xml) as Record<string, unknown>;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function getString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Equipe {
  libEquipe: string;
  libDivision: string;
  lienDivision: string;
  idEpreuve: string;
  libEpreuve: string;
}

export interface MatchResult {
  libelle: string;
  equipeA: string;
  equipeB: string;
  scoreA: string;
  scoreB: string;
  lien: string;
  datePrevue: string;
  dateReelle: string;
}

export interface ClassementEquipe {
  poule: string;
  clt: string;
  equipe: string;
  joue: string;
  pts: string;
  numero: string;
  totvic: string;
  totdef: string;
  idequipe: string;
  idclub: string;
  vic: string;
  def: string;
  nul: string;
  pf: string;
  pg: string;
  pp: string;
}

export interface ChpRencJoueur {
  xja: string;
  xca: string;
  xjb: string;
  xcb: string;
}

export interface ChpRencPartie {
  ja: string;
  scorea: string;
  jb: string;
  scoreb: string;
  detail: string;
}

export interface ChpRencResultat {
  equa: string;
  equb: string;
  resa: string;
  resb: string;
}

export interface ChpRenc {
  resultat: ChpRencResultat;
  joueurs: ChpRencJoueur[];
  parties: ChpRencPartie[];
}

export interface Joueur {
  licence: string;
  nom: string;
  prenom: string;
  club: string;
  nclub: string;
  clast: string;
}

export interface LicenceB {
  idlicence: string;
  nom: string;
  prenom: string;
  licence: string;
  numclub: string;
  nomclub: string;
  sexe: string;
  type: string;
  point: string;
  cat: string;
  pointm: string;
  apointm: string;
  initm: string;
  natio: string;
}

export interface Partie {
  licence: string;
  advlic: string;
  vd: string;
  numjourn: string;
  codechamp: string;
  date: string;
  advsexe: string;
  advnompre: string;
  pointres: string;
  coefchamp: string;
  advclaof: string;
  idpartie: string;
}

export interface Historique {
  echelon: string;
  place: string;
  point: string;
  saison: string;
  phase: string;
}

export interface Epreuve {
  idepreuve: string;
  idorga: string;
  libelle: string;
  typepreuve: string;
}

export interface Division {
  iddivision: string;
  libelle: string;
}

export interface ResCla {
  rang: string;
  nom: string;
  clt: string;
  club: string;
  points: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Team-related parsers
// ─────────────────────────────────────────────────────────────────────────────

export function parseEquipes(xml: string): Equipe[] {
  const data = parseXml(xml) as { liste?: { equipe?: unknown } };
  const items = toArray(data.liste?.equipe as Equipe | Equipe[] | undefined);
  return items.map((item) => {
    const raw = item as unknown as Record<string, unknown>;
    return {
      libEquipe: getString(raw.libequipe),
      libDivision: getString(raw.libdivision),
      lienDivision: getString(raw.liendivision),
      idEpreuve: getString(raw.idepr),
      libEpreuve: getString(raw.libepr),
    };
  });
}

export function parseResultEquMatches(xml: string): MatchResult[] {
  const data = parseXml(xml) as { liste?: { tour?: unknown } };
  const items = toArray(data.liste?.tour as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    libelle: getString(raw.libelle),
    equipeA: getString(raw.equa),
    equipeB: getString(raw.equb),
    scoreA: getString(raw.scorea),
    scoreB: getString(raw.scoreb),
    lien: getString(raw.lien),
    datePrevue: getString(raw.dateprevue),
    dateReelle: getString(raw.datereelle),
  }));
}

export function parseClassement(xml: string): ClassementEquipe[] {
  const data = parseXml(xml) as { liste?: { classement?: unknown } };
  const items = toArray(data.liste?.classement as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    poule: getString(raw.poule),
    clt: getString(raw.clt),
    equipe: getString(raw.equipe),
    joue: getString(raw.joue),
    pts: getString(raw.pts),
    numero: getString(raw.numero),
    totvic: getString(raw.totvic),
    totdef: getString(raw.totdef),
    idequipe: getString(raw.idequipe),
    idclub: getString(raw.idclub),
    vic: getString(raw.vic),
    def: getString(raw.def),
    nul: getString(raw.nul),
    pf: getString(raw.pf),
    pg: getString(raw.pg),
    pp: getString(raw.pp),
  }));
}

export function parseChpRenc(xml: string): ChpRenc {
  const data = parseXml(xml) as {
    liste?: {
      resultat?: Record<string, unknown>;
      joueur?: unknown;
      partie?: unknown;
    };
  };

  const liste = data.liste ?? {};

  const resultatRaw = (liste.resultat ?? {}) as Record<string, unknown>;
  const resultat: ChpRencResultat = {
    equa: getString(resultatRaw.equa),
    equb: getString(resultatRaw.equb),
    resa: getString(resultatRaw.resa),
    resb: getString(resultatRaw.resb),
  };

  const joueurs = toArray(liste.joueur as Record<string, unknown> | Record<string, unknown>[] | undefined).map(
    (raw) => ({
      xja: getString(raw.xja),
      xca: getString(raw.xca),
      xjb: getString(raw.xjb),
      xcb: getString(raw.xcb),
    })
  );

  const parties = toArray(liste.partie as Record<string, unknown> | Record<string, unknown>[] | undefined).map(
    (raw) => ({
      ja: getString(raw.ja),
      scorea: getString(raw.scorea),
      jb: getString(raw.jb),
      scoreb: getString(raw.scoreb),
      detail: getString(raw.detail),
    })
  );

  return { resultat, joueurs, parties };
}

// ─────────────────────────────────────────────────────────────────────────────
// Player-related parsers
// ─────────────────────────────────────────────────────────────────────────────

export function parseJoueurs(xml: string): Joueur[] {
  const data = parseXml(xml) as { liste?: { joueur?: unknown } };
  const items = toArray(data.liste?.joueur as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    licence: getString(raw.licence),
    nom: getString(raw.nom),
    prenom: getString(raw.prenom),
    club: getString(raw.club),
    nclub: getString(raw.nclub),
    clast: getString(raw.clast),
  }));
}

export function parseLicenceB(xml: string): LicenceB[] {
  const data = parseXml(xml) as { liste?: { licence?: unknown } };
  const items = toArray(data.liste?.licence as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    idlicence: getString(raw.idlicence),
    nom: getString(raw.nom),
    prenom: getString(raw.prenom),
    licence: getString(raw.licence),
    numclub: getString(raw.numclub),
    nomclub: getString(raw.nomclub),
    sexe: getString(raw.sexe),
    type: getString(raw.type),
    point: getString(raw.point),
    cat: getString(raw.cat),
    pointm: getString(raw.pointm),
    apointm: getString(raw.apointm),
    initm: getString(raw.initm),
    natio: getString(raw.natio),
  }));
}

export function parseParties(xml: string): Partie[] {
  const data = parseXml(xml) as { liste?: { partie?: unknown } };
  const items = toArray(data.liste?.partie as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    licence: getString(raw.licence),
    advlic: getString(raw.advlic),
    vd: getString(raw.vd),
    numjourn: getString(raw.numjourn),
    codechamp: getString(raw.codechamp),
    date: getString(raw.date),
    advsexe: getString(raw.advsexe),
    advnompre: getString(raw.advnompre),
    pointres: getString(raw.pointres),
    coefchamp: getString(raw.coefchamp),
    advclaof: getString(raw.advclaof),
    idpartie: getString(raw.idpartie),
  }));
}

export function parseHistorique(xml: string): Historique[] {
  const data = parseXml(xml) as { liste?: { histo?: unknown } };
  const items = toArray(data.liste?.histo as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    echelon: getString(raw.echelon),
    place: getString(raw.place),
    point: getString(raw.point),
    saison: getString(raw.saison),
    phase: getString(raw.phase),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Criterium-related parsers
// ─────────────────────────────────────────────────────────────────────────────

export function parseEpreuves(xml: string): Epreuve[] {
  const data = parseXml(xml) as { liste?: { epreuve?: unknown } };
  const items = toArray(data.liste?.epreuve as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    idepreuve: getString(raw.idepreuve),
    idorga: getString(raw.idorga),
    libelle: getString(raw.libelle),
    typepreuve: getString(raw.typepreuve),
  }));
}

export function parseDivisions(xml: string): Division[] {
  const data = parseXml(xml) as { liste?: { division?: unknown } };
  const items = toArray(data.liste?.division as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    iddivision: getString(raw.iddivision),
    libelle: getString(raw.libelle),
  }));
}

export function parseResCla(xml: string): ResCla[] {
  const data = parseXml(xml) as { liste?: { classement?: unknown } };
  const items = toArray(data.liste?.classement as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    rang: getString(raw.rang),
    nom: getString(raw.nom),
    clt: getString(raw.clt),
    club: getString(raw.club),
    points: getString(raw.points),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// xml_result_indiv parsers
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultIndivPoule {
  libelle: string;
  lien: string;
  date: string;
}

export interface ResultIndivClassement {
  rang: string;
  nom: string;
  clt: string;
  club: string;
  points: string;
}

export interface ResultIndivPartie {
  libelle: string;
  vain: string;
  perd: string;
  forfait: boolean;
}

export function parseResultIndivPoules(xml: string): ResultIndivPoule[] {
  const data = parseXml(xml) as { liste?: { tour?: unknown } };
  const items = toArray(data.liste?.tour as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    libelle: getString(raw.libelle),
    lien: getString(raw.lien),
    date: getString(raw.date),
  }));
}

export function parseResultIndivClassement(xml: string): ResultIndivClassement[] {
  const data = parseXml(xml) as { liste?: { classement?: unknown } };
  const items = toArray(data.liste?.classement as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    rang: getString(raw.rang),
    nom: getString(raw.nom),
    clt: getString(raw.clt),
    club: getString(raw.club),
    points: getString(raw.points),
  }));
}

export function parseResultIndivParties(xml: string): ResultIndivPartie[] {
  const data = parseXml(xml) as { liste?: { partie?: unknown } };
  const items = toArray(data.liste?.partie as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    libelle: getString(raw.libelle),
    vain: getString(raw.vain),
    perd: getString(raw.perd),
    forfait: raw.forfait !== undefined && raw.forfait !== null,
  }));
}

/**
 * Parse xml_partie (SPID) response
 * Returns: [{ date, nom, classement, epreuve, victoire, forfait, idpartie, coefchamp }]
 */
export function parsePartieSpid(xml: string) {
  const data = parseXml(xml) as { liste?: { partie?: unknown } };
  const items = toArray(data.liste?.partie as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((raw) => ({
    date: getString(raw.date),
    nom: getString(raw.nom),
    classement: getString(raw.classement),
    epreuve: getString(raw.epreuve),
    victoire: getString(raw.victoire),
    forfait: getString(raw.forfait),
    idpartie: getString(raw.idpartie),
    coefchamp: getString(raw.coefchamp),
  }));
}
