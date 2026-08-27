ALTER TABLE "settings" ADD COLUMN "open_slot_visibility" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "assignment_receipt" boolean DEFAULT true NOT NULL;