CREATE TABLE "assignment_expenses" (
	"game_id" text NOT NULL,
	"referee_id" text NOT NULL,
	"travel_mode" text,
	"km" integer,
	"per_diem_cents" integer,
	"other_cents" integer,
	"other_label" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "assignment_expenses_game_id_referee_id_pk" PRIMARY KEY("game_id","referee_id")
);
--> statement-breakpoint
CREATE TABLE "km_rates" (
	"valid_from" timestamp with time zone PRIMARY KEY NOT NULL,
	"solo_cents" integer NOT NULL,
	"shared_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_fees" (
	"league_id" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"fee_cents" integer,
	CONSTRAINT "league_fees_league_id_valid_from_pk" PRIMARY KEY("league_id","valid_from")
);
--> statement-breakpoint
ALTER TABLE "assignment_expenses" ADD CONSTRAINT "assignment_expenses_updated_by_referees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."referees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_expenses" ADD CONSTRAINT "assignment_expenses_game_id_referee_id_assignments_game_id_referee_id_fk" FOREIGN KEY ("game_id","referee_id") REFERENCES "public"."assignments"("game_id","referee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_fees" ADD CONSTRAINT "league_fees_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;
