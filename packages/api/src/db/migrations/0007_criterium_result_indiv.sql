-- Drop old criterium_classement table
DROP TABLE IF EXISTS "criterium_classement";

-- Create criterium_tours table
CREATE TABLE IF NOT EXISTS "criterium_tours" (
  "id" serial PRIMARY KEY NOT NULL,
  "epreuve_id" varchar NOT NULL,
  "epreuve_libelle" varchar NOT NULL,
  "division_id" varchar NOT NULL,
  "division_libelle" varchar NOT NULL,
  "tour" integer NOT NULL,
  "groupe" varchar NOT NULL,
  "cx_tableau" varchar NOT NULL,
  "date_tour" varchar NOT NULL,
  "niveau" varchar NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "criterium_tours_division_id_cx_tableau_unique" UNIQUE("division_id","cx_tableau")
);

-- Create new criterium_classement table with tour reference
CREATE TABLE IF NOT EXISTS "criterium_classement" (
  "id" serial PRIMARY KEY NOT NULL,
  "criterium_tour_id" integer NOT NULL REFERENCES "criterium_tours"("id"),
  "rang" integer NOT NULL,
  "licence" varchar REFERENCES "joueurs"("licence"),
  "nom" varchar NOT NULL,
  "club" varchar NOT NULL,
  "classement" integer NOT NULL,
  "points" varchar NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "criterium_classement_criterium_tour_id_nom_unique" UNIQUE("criterium_tour_id","nom")
);

-- Create criterium_parties table
CREATE TABLE IF NOT EXISTS "criterium_parties" (
  "id" serial PRIMARY KEY NOT NULL,
  "criterium_tour_id" integer NOT NULL REFERENCES "criterium_tours"("id"),
  "libelle" varchar NOT NULL,
  "vainqueur" varchar NOT NULL,
  "perdant" varchar NOT NULL,
  "forfait" boolean NOT NULL DEFAULT false
);
