CREATE TYPE "public"."moderation_action_type" AS ENUM('warn', 'suspend', 'restore', 'hide', 'unhide', 'remove', 'require_verification', 'escalate');--> statement-breakpoint
CREATE TABLE "moderation_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid,
	"moderator_id" uuid NOT NULL,
	"target_type" "report_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"action_type" "moderation_action_type" NOT NULL,
	"reason" text NOT NULL,
	"scope" jsonb,
	"duration_hours" integer,
	"expires_at" timestamp,
	"is_reversible" boolean DEFAULT true NOT NULL,
	"reversed_by_moderation_action_id" uuid,
	"reversed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "requires_reverification" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "moderation_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "is_moderation_suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recruitment_listing" ADD COLUMN "moderation_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "is_moderation_suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "update_post" ADD COLUMN "moderation_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_action" ADD CONSTRAINT "moderation_action_case_id_user_report_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."user_report"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_action_target_idx" ON "moderation_action" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "moderation_action_case_idx" ON "moderation_action" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "moderation_action_moderator_idx" ON "moderation_action" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "moderation_action_type_idx" ON "moderation_action" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "moderation_action_created_idx" ON "moderation_action" USING btree ("created_at");