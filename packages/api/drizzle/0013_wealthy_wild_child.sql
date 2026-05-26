ALTER TYPE "public"."notification_type" ADD VALUE 'scrim_rescheduled' BEFORE 'scrim_reminder';--> statement-breakpoint
CREATE TABLE "scrim_negotiation_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrim_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_team_id" uuid,
	"action" text NOT NULL,
	"prior_scheduled_at" timestamp,
	"proposed_scheduled_at" timestamp,
	"prior_config" jsonb,
	"proposed_config" jsonb,
	"prior_message" text,
	"proposed_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scrim_negotiation_revision" ADD CONSTRAINT "scrim_negotiation_revision_scrim_id_scrim_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_negotiation_revision" ADD CONSTRAINT "scrim_negotiation_revision_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrim_negotiation_revision" ADD CONSTRAINT "scrim_negotiation_revision_actor_team_id_team_id_fk" FOREIGN KEY ("actor_team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scrim_neg_rev_scrim_idx" ON "scrim_negotiation_revision" USING btree ("scrim_id");--> statement-breakpoint
CREATE INDEX "scrim_neg_rev_actor_user_idx" ON "scrim_negotiation_revision" USING btree ("actor_user_id");