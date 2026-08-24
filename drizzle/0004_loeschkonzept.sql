ALTER TABLE "assignments" DROP CONSTRAINT "assignments_referee_id_referees_id_fk";
--> statement-breakpoint
ALTER TABLE "promotion_offers" DROP CONSTRAINT "promotion_offers_referee_id_referees_id_fk";
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_referee_id_referees_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."referees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_offers" ADD CONSTRAINT "promotion_offers_referee_id_referees_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."referees"("id") ON DELETE cascade ON UPDATE no action;