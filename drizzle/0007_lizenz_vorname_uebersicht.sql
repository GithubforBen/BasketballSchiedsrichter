ALTER TABLE "games" ADD COLUMN "required_license" text DEFAULT 'E' NOT NULL;--> statement-breakpoint
ALTER TABLE "referees" ADD COLUMN "first_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "referees" ADD COLUMN "license" text;--> statement-breakpoint
ALTER TABLE "referees" ADD COLUMN "digest_weeks" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "referees" ADD COLUMN "digest_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Bestehende Konten bekommen das erste Wort ihres Namens als Vorname. Der Admin
-- korrigiert, wo das nicht passt; leer bliebe die Anrede sonst stehen.
UPDATE "referees" SET "first_name" = split_part("name", ' ', 1) WHERE "first_name" = '';
