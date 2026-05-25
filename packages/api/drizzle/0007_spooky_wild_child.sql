CREATE TABLE "ownership_workflow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requester_user_id" uuid,
	"current_owner_user_id" uuid,
	"recipient_user_id" uuid,
	"recovery_target_user_id" uuid,
	"verification_state" text DEFAULT 'required' NOT NULL,
	"review_state" text DEFAULT 'not_required' NOT NULL,
	"reason" text,
	"expires_at" timestamp,
	"resolved_at" timestamp,
	"result" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ownership_workflow" ADD CONSTRAINT "ownership_workflow_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_workflow" ADD CONSTRAINT "ownership_workflow_current_owner_user_id_user_id_fk" FOREIGN KEY ("current_owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_workflow" ADD CONSTRAINT "ownership_workflow_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_workflow" ADD CONSTRAINT "ownership_workflow_recovery_target_user_id_user_id_fk" FOREIGN KEY ("recovery_target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ownership_workflow_target_idx" ON "ownership_workflow" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ownership_workflow_requester_idx" ON "ownership_workflow" USING btree ("requester_user_id");--> statement-breakpoint
CREATE INDEX "ownership_workflow_recipient_idx" ON "ownership_workflow" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ownership_workflow_open_unique_idx" ON "ownership_workflow" USING btree ("entity_type","entity_id") WHERE "ownership_workflow"."status" in ('pending', 'review_required', 'blocked');--> statement-breakpoint
CREATE TABLE "ownership_workflow_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ownership_workflow_event" ADD CONSTRAINT "ownership_workflow_event_workflow_id_ownership_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."ownership_workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_workflow_event" ADD CONSTRAINT "ownership_workflow_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ownership_workflow_event_workflow_idx" ON "ownership_workflow_event" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "ownership_workflow_event_actor_idx" ON "ownership_workflow_event" USING btree ("actor_user_id");
