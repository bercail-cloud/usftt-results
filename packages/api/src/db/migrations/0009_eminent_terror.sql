CREATE TABLE IF NOT EXISTS "criterium_parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"criterium_tour_id" integer NOT NULL,
	"libelle" varchar NOT NULL,
	"vainqueur" varchar NOT NULL,
	"perdant" varchar NOT NULL,
	"forfait" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "criterium_classement" DROP CONSTRAINT IF EXISTS "criterium_classement_division_id_nom_tour_unique";--> statement-breakpoint
ALTER TABLE "criterium_classement" ALTER COLUMN "points" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "joueurs" ALTER COLUMN "points_mensuels" SET DATA TYPE real;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "criterium_classement" ADD COLUMN "criterium_tour_id" integer NOT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "joueurs" ADD COLUMN "ancien_points_mensuels" real; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "joueurs" ADD COLUMN "points_initm" real; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "joueurs" ADD COLUMN "type_licence" varchar; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "parties_individuelles" ADD COLUMN "adversaire_rang" varchar; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "parties_individuelles" ADD COLUMN "epreuve_libelle" varchar; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "parties_individuelles" ADD COLUMN "id_partie" varchar; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "rencontres" ADD COLUMN "detail_equa" varchar; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "rencontres" ADD COLUMN "detail_equb" varchar; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "criterium_parties" DROP CONSTRAINT IF EXISTS "criterium_parties_criterium_tour_id_criterium_tours_id_fk";--> statement-breakpoint
ALTER TABLE "criterium_parties" ADD CONSTRAINT "criterium_parties_criterium_tour_id_criterium_tours_id_fk" FOREIGN KEY ("criterium_tour_id") REFERENCES "public"."criterium_tours"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterium_classement" DROP CONSTRAINT IF EXISTS "criterium_classement_criterium_tour_id_criterium_tours_id_fk";--> statement-breakpoint
ALTER TABLE "criterium_classement" ADD CONSTRAINT "criterium_classement_criterium_tour_id_criterium_tours_id_fk" FOREIGN KEY ("criterium_tour_id") REFERENCES "public"."criterium_tours"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "criterium_classement" DROP COLUMN "division_id"; EXCEPTION WHEN undefined_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "criterium_classement" DROP COLUMN "division_libelle"; EXCEPTION WHEN undefined_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "criterium_classement" DROP COLUMN "tour"; EXCEPTION WHEN undefined_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "criterium_classement" ADD CONSTRAINT "criterium_classement_criterium_tour_id_nom_unique" UNIQUE("criterium_tour_id","nom"); EXCEPTION WHEN duplicate_table THEN NULL; END $$;
