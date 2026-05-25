-- D1-P/D2-P: Separate workflow process state from entity lifecycle state.
-- workflow_state tracks whether this workflow row is still open or has been settled,
-- and backs the unique index so concurrent workflow initiation is impossible.
DROP INDEX "lifecycle_workflow_open_unique_idx";--> statement-breakpoint
ALTER TABLE "lifecycle_workflow" ADD COLUMN "workflow_state" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lifecycle_workflow_open_unique_idx" ON "lifecycle_workflow" USING btree ("entity_type","entity_id") WHERE "lifecycle_workflow"."workflow_state" = 'open';--> statement-breakpoint

-- D3-P: Enforce the invariant that isArchived mirrors lifecycleStatus on teams.
ALTER TABLE "team" ADD CONSTRAINT "team_archived_lifecycle_consistent"
    CHECK (is_archived = (lifecycle_status != 'active'));