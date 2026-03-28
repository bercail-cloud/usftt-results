CREATE TABLE "sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_name" varchar NOT NULL,
	"level" varchar NOT NULL,
	"message" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
