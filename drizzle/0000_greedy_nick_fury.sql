CREATE TABLE "assignments" (
	"game_id" text NOT NULL,
	"slot_index" smallint NOT NULL,
	"referee_id" text NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"played_as_referee" boolean,
	CONSTRAINT "assignments_game_id_slot_index_pk" PRIMARY KEY("game_id","slot_index")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"game_id" text,
	"subject_id" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"kickoff" timestamp (0) with time zone NOT NULL,
	"league_id" text NOT NULL,
	"home" text NOT NULL,
	"away" text NOT NULL,
	"venue" text NOT NULL,
	"state" text DEFAULT 'scheduled' NOT NULL,
	"relocation_version" integer DEFAULT 0 NOT NULL,
	"override_withdraw" boolean DEFAULT false NOT NULL,
	"override_substitute_request" boolean DEFAULT false NOT NULL,
	"override_one_game_per_day" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"referee_id" text NOT NULL,
	"link_token_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"recipient_id" text NOT NULL,
	"game_id" text,
	"payload" jsonb NOT NULL,
	"cost_units" integer DEFAULT 1 NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"send_after" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "promotion_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"target_slot" smallint NOT NULL,
	"substitute_slot" smallint NOT NULL,
	"referee_id" text NOT NULL,
	"respond_by" timestamp with time zone NOT NULL,
	"outcome" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qualifications" (
	"referee_id" text NOT NULL,
	"league_id" text NOT NULL,
	CONSTRAINT "qualifications_referee_id_league_id_pk" PRIMARY KEY("referee_id","league_id")
);
--> statement-breakpoint
CREATE TABLE "referees" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"initials" text NOT NULL,
	"phone" text NOT NULL,
	"role" text DEFAULT 'referee' NOT NULL,
	"avatar_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"reminder_hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_screen" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"withdraw_deadline_days" integer DEFAULT 21 NOT NULL,
	"substitute_request_deadline_days" integer DEFAULT 3 NOT NULL,
	"confirmation_lead_hours" integer DEFAULT 72 NOT NULL,
	"confirmation_follow_up_hours" integer DEFAULT 24 NOT NULL,
	"reminder_limit" integer DEFAULT 10 NOT NULL,
	"reminder_cost_warning_from" integer DEFAULT 4 NOT NULL,
	"reminder_min_hours" integer DEFAULT 1 NOT NULL,
	"reminder_max_hours" integer DEFAULT 168 NOT NULL,
	"promotion_response_hours" integer DEFAULT 12 NOT NULL,
	"one_game_per_day" boolean DEFAULT true NOT NULL,
	"rotation" boolean DEFAULT true NOT NULL,
	"rotation_window" text DEFAULT 'week' NOT NULL,
	"auto_nudge" boolean DEFAULT true NOT NULL,
	"alert_unfilled" boolean DEFAULT true NOT NULL,
	"alert_confirmation_overdue" boolean DEFAULT true NOT NULL,
	"alert_substitute_missing" boolean DEFAULT true NOT NULL,
	"alert_cancellation" boolean DEFAULT true NOT NULL,
	"alert_daily_digest" boolean DEFAULT true NOT NULL,
	"alert_after_import" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_referee_id_referees_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."referees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_referees_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."referees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_referee_id_referees_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."referees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_recipient_id_referees_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."referees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_offers" ADD CONSTRAINT "promotion_offers_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_offers" ADD CONSTRAINT "promotion_offers_referee_id_referees_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."referees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_referee_id_referees_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."referees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_one_slot_per_referee" ON "assignments" USING btree ("game_id","referee_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "games_kickoff_idx" ON "games" USING btree ("kickoff");--> statement-breakpoint
CREATE UNIQUE INDEX "games_natural_key" ON "games" USING btree ("kickoff","home","away");--> statement-breakpoint
CREATE INDEX "login_tokens_referee_idx" ON "login_tokens" USING btree ("referee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_key" ON "notification_outbox" USING btree ("key","recipient_id");--> statement-breakpoint
CREATE INDEX "notification_outbox_due_idx" ON "notification_outbox" USING btree ("state","send_after");--> statement-breakpoint
CREATE INDEX "promotion_offers_game_idx" ON "promotion_offers" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referees_phone_key" ON "referees" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "referees_initials_key" ON "referees" USING btree ("initials");