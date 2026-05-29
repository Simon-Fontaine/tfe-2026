CREATE TYPE "public"."moderation_case_action" AS ENUM('viewed', 'assigned', 'unassigned', 'noted', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "moderation_case_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"moderator_id" uuid NOT NULL,
	"action" "moderation_case_action" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_report" ADD COLUMN "assigned_moderator_id" uuid;--> statement-breakpoint
ALTER TABLE "user_report" ADD COLUMN "assigned_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_report" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "moderation_case_event" ADD CONSTRAINT "moderation_case_event_report_id_user_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."user_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case_event" ADD CONSTRAINT "moderation_case_event_moderator_id_user_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_case_event_report_idx" ON "moderation_case_event" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "moderation_case_event_moderator_idx" ON "moderation_case_event" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "moderation_case_event_action_idx" ON "moderation_case_event" USING btree ("action");--> statement-breakpoint
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_assigned_moderator_id_user_id_fk" FOREIGN KEY ("assigned_moderator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;