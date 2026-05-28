ALTER TABLE "scrim" ADD COLUMN "dispute_response" text;--> statement-breakpoint
ALTER TABLE "scrim" ADD COLUMN "dispute_responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scrim" ADD COLUMN "dispute_responded_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "scrim" ADD CONSTRAINT "scrim_dispute_responded_by_user_id_user_id_fk" FOREIGN KEY ("dispute_responded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;