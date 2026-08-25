CREATE TABLE "admin_recovery_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"referee_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "referees" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "referees" ADD COLUMN "own_password_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "referees" ADD COLUMN "start_password_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_recovery_tokens" ADD CONSTRAINT "admin_recovery_tokens_referee_id_referees_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."referees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_recovery_referee_idx" ON "admin_recovery_tokens" USING btree ("referee_id");