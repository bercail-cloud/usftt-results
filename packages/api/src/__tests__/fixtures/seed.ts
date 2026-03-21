export function createMockEquipe(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    lib_equipe: "USFTT 1",
    lib_division: "L08_PN Messieurs phase 1 Poule 1",
    id_poule: "123",
    id_division: "456",
    id_epreuve: "EP1",
    lib_epreuve: "Championnat",
    type_epreuve: "M",
    updated_at: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function createMockClassement(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    equipe_id: 1,
    club_numero: "08940001",
    nom_equipe: "USFTT 1",
    position: 1,
    points: 10,
    joue: 5,
    victoires: 5,
    defaites: 0,
    nuls: 0,
    parties_gagnees: 25,
    parties_perdues: 10,
    updated_at: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function createMockRencontre(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    equipe_id: 1,
    libelle: "J1 - USFTT 1 vs ADVERSAIRE",
    equipe_a: "USFTT 1",
    equipe_b: "ADVERSAIRE",
    score_a: 5,
    score_b: 4,
    date_prevue: "2024-01-15",
    date_reelle: "2024-01-15",
    lien_detail: null,
    is_domicile: true,
    updated_at: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function createMockPartieRencontre(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: 1,
    rencontre_id: 1,
    joueur_a: "DUPONT Jean",
    classement_a: "1500",
    joueur_b: "MARTIN Pierre",
    classement_b: "1400",
    score_a: 3,
    score_b: 1,
    detail_sets: "11-8,11-6,11-9",
    updated_at: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function createMockCriteriumTour(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: 1,
    epreuve_id: "EP1",
    epreuve_libelle: "Criterium Federal",
    division_id: "DIV1",
    division_libelle: "Division 1",
    tour: 1,
    groupe: "Gr1",
    cx_tableau: "CT1",
    date_tour: "13/03/2026",
    niveau: "National",
    updated_at: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function createMockCriteriumClassement(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: 1,
    criterium_tour_id: 1,
    rang: 1,
    licence: "0940001",
    nom: "DUPONT Jean",
    club: "USFTT",
    classement: 1500,
    points: "100A",
    updated_at: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function createMockCriteriumPartie(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: 1,
    criterium_tour_id: 1,
    libelle: "Finale",
    vainqueur: "DUPONT Jean",
    perdant: "MARTIN Paul",
    forfait: false,
    ...overrides,
  };
}

export function createMockJoueur(overrides: Record<string, unknown> = {}) {
  return {
    licence: "0940001",
    nom: "DUPONT",
    prenom: "Jean",
    club_numero: "08940001",
    points_officiels: 1500,
    points_mensuels: 1520,
    categorie: "S",
    rang_departemental: 1,
    rang_regional: 5,
    sexe: "M",
    updated_at: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function createMockSyncStatus(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    job_name: "sync-equipes",
    last_run: new Date("2024-01-01T12:00:00Z"),
    status: "success",
    error_message: null,
    ...overrides,
  };
}
