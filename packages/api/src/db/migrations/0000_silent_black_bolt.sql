CREATE TABLE "classements_poule" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipe_id" integer NOT NULL,
	"club_numero" varchar NOT NULL,
	"nom_equipe" varchar NOT NULL,
	"position" integer NOT NULL,
	"points" integer NOT NULL,
	"joue" integer NOT NULL,
	"victoires" integer NOT NULL,
	"defaites" integer NOT NULL,
	"nuls" integer NOT NULL,
	"parties_gagnees" integer NOT NULL,
	"parties_perdues" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criterium_classement" (
	"id" serial PRIMARY KEY NOT NULL,
	"division_id" varchar NOT NULL,
	"division_libelle" varchar NOT NULL,
	"rang" integer NOT NULL,
	"licence" varchar,
	"nom" varchar NOT NULL,
	"club" varchar NOT NULL,
	"classement" integer NOT NULL,
	"points" integer NOT NULL,
	"tour" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"lib_equipe" varchar NOT NULL,
	"lib_division" varchar NOT NULL,
	"id_poule" varchar NOT NULL,
	"id_division" varchar NOT NULL,
	"id_epreuve" varchar NOT NULL,
	"lib_epreuve" varchar NOT NULL,
	"type_epreuve" varchar NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historique_classement" (
	"id" serial PRIMARY KEY NOT NULL,
	"licence" varchar NOT NULL,
	"saison" varchar NOT NULL,
	"phase" integer NOT NULL,
	"points" integer NOT NULL,
	CONSTRAINT "historique_classement_licence_saison_phase_unique" UNIQUE("licence","saison","phase")
);
--> statement-breakpoint
CREATE TABLE "joueurs" (
	"licence" varchar PRIMARY KEY NOT NULL,
	"nom" varchar NOT NULL,
	"prenom" varchar NOT NULL,
	"club_numero" varchar NOT NULL,
	"points_officiels" integer,
	"points_mensuels" integer,
	"categorie" varchar,
	"rang_departemental" integer,
	"rang_regional" integer,
	"sexe" varchar NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties_individuelles" (
	"id" serial PRIMARY KEY NOT NULL,
	"licence" varchar NOT NULL,
	"adversaire_licence" varchar NOT NULL,
	"adversaire_nom" varchar NOT NULL,
	"adversaire_classement" integer NOT NULL,
	"victoire" boolean NOT NULL,
	"points_resultat" real NOT NULL,
	"coefficient" real NOT NULL,
	"date_partie" varchar NOT NULL,
	"epreuve" varchar NOT NULL,
	"journee" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties_rencontre" (
	"id" serial PRIMARY KEY NOT NULL,
	"rencontre_id" integer NOT NULL,
	"joueur_a" varchar NOT NULL,
	"classement_a" varchar NOT NULL,
	"joueur_b" varchar NOT NULL,
	"classement_b" varchar NOT NULL,
	"score_a" integer NOT NULL,
	"score_b" integer NOT NULL,
	"detail_sets" varchar NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rencontres" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipe_id" integer NOT NULL,
	"libelle" varchar NOT NULL,
	"equipe_a" varchar NOT NULL,
	"equipe_b" varchar NOT NULL,
	"score_a" integer,
	"score_b" integer,
	"date_prevue" varchar NOT NULL,
	"date_reelle" varchar NOT NULL,
	"lien_detail" varchar,
	"is_domicile" boolean NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_name" varchar NOT NULL,
	"last_run" timestamp NOT NULL,
	"status" varchar NOT NULL,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "classements_poule" ADD CONSTRAINT "classements_poule_equipe_id_equipes_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterium_classement" ADD CONSTRAINT "criterium_classement_licence_joueurs_licence_fk" FOREIGN KEY ("licence") REFERENCES "public"."joueurs"("licence") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historique_classement" ADD CONSTRAINT "historique_classement_licence_joueurs_licence_fk" FOREIGN KEY ("licence") REFERENCES "public"."joueurs"("licence") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties_individuelles" ADD CONSTRAINT "parties_individuelles_licence_joueurs_licence_fk" FOREIGN KEY ("licence") REFERENCES "public"."joueurs"("licence") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties_rencontre" ADD CONSTRAINT "parties_rencontre_rencontre_id_rencontres_id_fk" FOREIGN KEY ("rencontre_id") REFERENCES "public"."rencontres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_equipe_id_equipes_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipes"("id") ON DELETE no action ON UPDATE no action;