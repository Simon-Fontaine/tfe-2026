ALTER TYPE "public"."verification_action" ADD VALUE 'organization_ownership_transfer';--> statement-breakpoint
ALTER TYPE "public"."verification_action" ADD VALUE 'team_ownership_transfer';--> statement-breakpoint
ALTER TABLE "ownership_workflow" DROP CONSTRAINT "ownership_workflow_recovery_target_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "domain_audit_event" ALTER COLUMN "action_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."domain_audit_action_type";--> statement-breakpoint
CREATE TYPE "public"."domain_audit_action_type" AS ENUM('ownership_transfer_initiated', 'ownership_transfer_accepted', 'ownership_transfer_declined', 'permission_role_changed', 'permission_member_removed', 'moderation_action_taken', 'moderation_action_reversed', 'result_correction_applied', 'dispute_initiated', 'dispute_responded', 'dispute_resolved', 'dispute_voided', 'evidence_uploaded', 'evidence_removed', 'account_deletion_requested', 'account_deletion_confirmed', 'account_deletion_cancelled', 'data_export_requested', 'lifecycle_archived', 'lifecycle_restored', 'lifecycle_deletion_pending', 'governance_containment_applied');--> statement-breakpoint
ALTER TABLE "domain_audit_event" ALTER COLUMN "action_type" SET DATA TYPE "public"."domain_audit_action_type" USING "action_type"::"public"."domain_audit_action_type";--> statement-breakpoint
DROP INDEX "ownership_workflow_open_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "ownership_workflow_open_unique_idx" ON "ownership_workflow" USING btree ("entity_type","entity_id") WHERE "ownership_workflow"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "ownership_workflow" DROP COLUMN "recovery_target_user_id";--> statement-breakpoint
ALTER TABLE "ownership_workflow" DROP COLUMN "review_state";