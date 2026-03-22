import { fetchFftt } from "./client.js";
import {
  parseEquipes,
  parseResultEquMatches,
  parseClassement,
  parseChpRenc,
  parseJoueurs,
  parseLicenceB,
  parseParties,
  parsePartieSpid,
  parseHistorique,
  parseEpreuves,
  parseDivisions,
  parseResCla,
  parseResultIndivPoules,
  parseResultIndivClassement,
  parseResultIndivParties,
} from "./xml-parser.js";
import type {
  Equipe,
  MatchResult,
  ClassementEquipe,
  ChpRenc,
  Joueur,
  LicenceB,
  Partie,
  Historique,
  Epreuve,
  Division,
  ResCla,
  ResultIndivPoule,
  ResultIndivClassement,
  ResultIndivPartie,
} from "./xml-parser.js";

export type { Equipe, MatchResult, ClassementEquipe, ChpRenc, Joueur, LicenceB, Partie, Historique, Epreuve, Division, ResCla, ResultIndivPoule, ResultIndivClassement, ResultIndivPartie };

export async function getEquipes(
  numclu: string,
  appId: string,
  serie: string,
  password: string,
  type?: string
): Promise<Equipe[]> {
  const params: Record<string, string> = { numclu };
  if (type !== undefined) params.type = type;
  const xml = await fetchFftt("xml_equipe", params, appId, serie, password);
  return parseEquipes(xml);
}

export async function getResultEquMatches(
  D1: string,
  cxPoule: string,
  appId: string,
  serie: string,
  password: string
): Promise<MatchResult[]> {
  const xml = await fetchFftt(
    "xml_result_equ",
    { D1, cx_poule: cxPoule },
    appId,
    serie,
    password
  );
  return parseResultEquMatches(xml);
}

export async function getResultEquClassement(
  D1: string,
  cxPoule: string,
  appId: string,
  serie: string,
  password: string
): Promise<ClassementEquipe[]> {
  const xml = await fetchFftt(
    "xml_result_equ",
    { D1, cx_poule: cxPoule, action: "classement" },
    appId,
    serie,
    password
  );
  return parseClassement(xml);
}

export async function getResultEquPoules(
  D1: string,
  appId: string,
  serie: string,
  password: string
): Promise<MatchResult[]> {
  const xml = await fetchFftt(
    "xml_result_equ",
    { D1, action: "poule" },
    appId,
    serie,
    password
  );
  return parseResultEquMatches(xml);
}

export async function getChpRenc(
  lienParams: Record<string, string>,
  appId: string,
  serie: string,
  password: string
): Promise<ChpRenc> {
  const xml = await fetchFftt("xml_chp_renc", lienParams, appId, serie, password);
  return parseChpRenc(xml);
}

export async function getJoueurs(
  club: string,
  appId: string,
  serie: string,
  password: string
): Promise<Joueur[]> {
  const xml = await fetchFftt(
    "xml_liste_joueur",
    { club },
    appId,
    serie,
    password
  );
  return parseJoueurs(xml);
}

export async function getLicenceB(
  params: { licence?: string; club?: string },
  appId: string,
  serie: string,
  password: string
): Promise<LicenceB[]> {
  const queryParams: Record<string, string> = {};
  if (params.licence !== undefined) queryParams.licence = params.licence;
  if (params.club !== undefined) queryParams.club = params.club;
  const xml = await fetchFftt("xml_licence_b", queryParams, appId, serie, password);
  return parseLicenceB(xml);
}

export async function getPartieMysql(
  licence: string,
  appId: string,
  serie: string,
  password: string
): Promise<Partie[]> {
  const xml = await fetchFftt(
    "xml_partie_mysql",
    { licence },
    appId,
    serie,
    password
  );
  return parseParties(xml);
}

export async function getHistoClassement(
  numlic: string,
  appId: string,
  serie: string,
  password: string
): Promise<Historique[]> {
  const xml = await fetchFftt(
    "xml_histo_classement",
    { numlic },
    appId,
    serie,
    password
  );
  return parseHistorique(xml);
}

export async function getEpreuves(
  organisme: string,
  type: string,
  appId: string,
  serie: string,
  password: string
): Promise<Epreuve[]> {
  const xml = await fetchFftt(
    "xml_epreuve",
    { organisme, type },
    appId,
    serie,
    password
  );
  return parseEpreuves(xml);
}

export async function getDivisions(
  organisme: string,
  epreuve: string,
  type: string,
  appId: string,
  serie: string,
  password: string
): Promise<Division[]> {
  const xml = await fetchFftt(
    "xml_division",
    { organisme, epreuve, type },
    appId,
    serie,
    password
  );
  return parseDivisions(xml);
}

export async function getResCla(
  resDivision: Record<string, string>,
  appId: string,
  serie: string,
  password: string
): Promise<ResCla[]> {
  const xml = await fetchFftt("xml_res_cla", resDivision, appId, serie, password);
  return parseResCla(xml);
}

export async function getResultIndivPoules(
  epr: string,
  resDivision: string,
  appId: string,
  serie: string,
  password: string
): Promise<ResultIndivPoule[]> {
  const xml = await fetchFftt(
    "xml_result_indiv",
    { action: "poule", epr, res_division: resDivision },
    appId,
    serie,
    password
  );
  return parseResultIndivPoules(xml);
}

export async function getResultIndivClassement(
  epr: string,
  resDivision: string,
  cxTableau: string,
  appId: string,
  serie: string,
  password: string
): Promise<ResultIndivClassement[]> {
  const xml = await fetchFftt(
    "xml_result_indiv",
    { action: "classement", epr, res_division: resDivision, cx_tableau: cxTableau },
    appId,
    serie,
    password
  );
  return parseResultIndivClassement(xml);
}

export async function getResultIndivParties(
  epr: string,
  resDivision: string,
  cxTableau: string,
  appId: string,
  serie: string,
  password: string
): Promise<ResultIndivPartie[]> {
  const xml = await fetchFftt(
    "xml_result_indiv",
    { action: "partie", epr, res_division: resDivision, cx_tableau: cxTableau },
    appId,
    serie,
    password
  );
  return parseResultIndivParties(xml);
}

/** xml_partie (SPID) - returns parties with epreuve libelle */
export async function getPartieSpid(
  numlic: string,
  appId: string,
  serie: string,
  password: string
) {
  const xml = await fetchFftt(
    "xml_partie",
    { numlic },
    appId,
    serie,
    password
  );
  return parsePartieSpid(xml);
}
