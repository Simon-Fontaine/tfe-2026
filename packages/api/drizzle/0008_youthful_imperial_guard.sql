CREATE TABLE "lifecycle_workflow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"actor_user_id" uuid,
	"reason" text,
	"recovery_until" timestamp,
	"settled_at" timestamp,
	"result" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "lifecycle_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "lifecycle_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "lifecycle_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "lifecycle_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "lifecycle_workflow" ADD CONSTRAINT "lifecycle_workflow_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lifecycle_workflow_target_idx" ON "lifecycle_workflow" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "lifecycle_workflow_actor_idx" ON "lifecycle_workflow" USING btree ("actor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lifecycle_workflow_open_unique_idx" ON "lifecycle_workflow" USING btree ("entity_type","entity_id") WHERE "lifecycle_workflow"."status" in ('archived', 'deletion_pending');