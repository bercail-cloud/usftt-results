import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const joueurs = pgTable("joueurs", {
  licence: varchar("licence").primaryKey(),
  nom: varchar("nom").notNull(),
  prenom: varchar("prenom").notNull(),
  club_numero: varchar("club_numero").notNull(),
  points_officiels: integer("points_officiels"),
  points_mensuels: real("points_mensuels"),
  ancien_points_mensuels: real("ancien_points_mensuels"),
  points_initm: real("points_initm"),
  categorie: varchar("categorie"),
  type_licence: varchar("type_licence"),
  rang_departemental: integer("rang_departemental"),
  rang_regional: integer("rang_regional"),
  sexe: varchar("sexe").notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const equipes = pgTable("equipes", {
  id: serial("id").primaryKey(),
  lib_equipe: varchar("lib_equipe").notNull(),
  lib_division: varchar("lib_division").notNull(),
  id_poule: varchar("id_poule").notNull(),
  id_division: varchar("id_division").notNull(),
  id_epreuve: varchar("id_epreuve").notNull(),
  lib_epreuve: varchar("lib_epreuve").notNull(),
  type_epreuve: varchar("type_epreuve").notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique().on(table.lib_equipe, table.id_epreuve),
]);

export const classements_poule = pgTable("classements_poule", {
  id: serial("id").primaryKey(),
  equipe_id: integer("equipe_id")
    .notNull()
    .references(() => equipes.id),
  club_numero: varchar("club_numero").notNull(),
  nom_equipe: varchar("nom_equipe").notNull(),
  position: integer("position").notNull(),
  points: integer("points").notNull(),
  joue: integer("joue").notNull(),
  victoires: integer("victoires").notNull(),
  defaites: integer("defaites").notNull(),
  nuls: integer("nuls").notNull(),
  parties_gagnees: integer("parties_gagnees").notNull(),
  parties_perdues: integer("parties_perdues").notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const rencontres = pgTable("rencontres", {
  id: serial("id").primaryKey(),
  equipe_id: integer("equipe_id")
    .notNull()
    .references(() => equipes.id),
  libelle: varchar("libelle").notNull(),
  equipe_a: varchar("equipe_a").notNull(),
  equipe_b: varchar("equipe_b").notNull(),
  score_a: integer("score_a"),
  score_b: integer("score_b"),
  date_prevue: varchar("date_prevue").notNull(),
  date_reelle: varchar("date_reelle").notNull(),
  lien_detail: varchar("lien_detail"),
  is_domicile: boolean("is_domicile").notNull(),
  detail_equa: varchar("detail_equa"),
  detail_equb: varchar("detail_equb"),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const parties_rencontre = pgTable("parties_rencontre", {
  id: serial("id").primaryKey(),
  rencontre_id: integer("rencontre_id")
    .notNull()
    .references(() => rencontres.id),
  joueur_a: varchar("joueur_a").notNull(),
  classement_a: varchar("classement_a").notNull(),
  joueur_b: varchar("joueur_b").notNull(),
  classement_b: varchar("classement_b").notNull(),
  score_a: integer("score_a").notNull(),
  score_b: integer("score_b").notNull(),
  detail_sets: varchar("detail_sets").notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const parties_individuelles = pgTable("parties_individuelles", {
  id: serial("id").primaryKey(),
  licence: varchar("licence")
    .notNull()
    .references(() => joueurs.licence),
  adversaire_licence: varchar("adversaire_licence").notNull(),
  adversaire_nom: varchar("adversaire_nom").notNull(),
  adversaire_classement: integer("adversaire_classement").notNull(),
  adversaire_rang: varchar("adversaire_rang"),
  victoire: boolean("victoire").notNull(),
  points_resultat: real("points_resultat").notNull(),
  coefficient: real("coefficient").notNull(),
  date_partie: varchar("date_partie").notNull(),
  epreuve: varchar("epreuve").notNull(),
  epreuve_libelle: varchar("epreuve_libelle"),
  id_partie: varchar("id_partie"),
  journee: integer("journee").notNull(),
  forfait: boolean("forfait").notNull().default(false),
});

export const historique_classement = pgTable(
  "historique_classement",
  {
    id: serial("id").primaryKey(),
    licence: varchar("licence")
      .notNull()
      .references(() => joueurs.licence),
    saison: varchar("saison").notNull(),
    phase: integer("phase").notNull(),
    points: integer("points").notNull(),
  },
  (table) => [unique().on(table.licence, table.saison, table.phase)],
);

export const criterium_tours = pgTable("criterium_tours", {
  id: serial("id").primaryKey(),
  epreuve_id: varchar("epreuve_id").notNull(),
  epreuve_libelle: varchar("epreuve_libelle").notNull(),
  division_id: varchar("division_id").notNull(),
  division_libelle: varchar("division_libelle").notNull(),
  tour: integer("tour").notNull(),
  groupe: varchar("groupe").notNull(),
  cx_tableau: varchar("cx_tableau").notNull(),
  date_tour: varchar("date_tour").notNull(),
  niveau: varchar("niveau").notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique().on(table.division_id, table.cx_tableau),
]);

export const criterium_classement = pgTable("criterium_classement", {
  id: serial("id").primaryKey(),
  criterium_tour_id: integer("criterium_tour_id")
    .notNull()
    .references(() => criterium_tours.id),
  rang: integer("rang").notNull(),
  licence: varchar("licence").references(() => joueurs.licence),
  nom: varchar("nom").notNull(),
  club: varchar("club").notNull(),
  classement: integer("classement").notNull(),
  points: varchar("points").notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique().on(table.criterium_tour_id, table.nom, table.classement),
]);

export const criterium_parties = pgTable("criterium_parties", {
  id: serial("id").primaryKey(),
  criterium_tour_id: integer("criterium_tour_id")
    .notNull()
    .references(() => criterium_tours.id),
  libelle: varchar("libelle").notNull(),
  vainqueur: varchar("vainqueur").notNull(),
  perdant: varchar("perdant").notNull(),
  forfait: boolean("forfait").notNull().default(false),
});

export const sync_status = pgTable("sync_status", {
  id: serial("id").primaryKey(),
  job_name: varchar("job_name").notNull().unique(),
  last_run: timestamp("last_run").notNull(),
  status: varchar("status").notNull(),
  error_message: text("error_message"),
});

export const sync_logs = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
  job_name: varchar("job_name").notNull(),
  level: varchar("level").notNull(), // info, warn, error
  message: text("message").notNull(),
  details: text("details"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});
