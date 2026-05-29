CREATE TYPE "public"."domain_audit_action_type" AS ENUM('ownership_transfer_initiated', 'ownership_transfer_accepted', 'ownership_transfer_declined', 'ownership_recovery_initiated', 'ownership_recovery_resolved', 'permission_role_changed', 'permission_member_removed', 'moderation_action_taken', 'moderation_action_reversed', 'result_correction_applied', 'dispute_initiated', 'dispute_responded', 'dispute_resolved', 'dispute_voided', 'evidence_uploaded', 'evidence_removed', 'account_deletion_requested', 'account_deletion_confirmed', 'account_deletion_cancelled', 'data_export_requested', 'lifecycle_archived', 'lifecycle_restored', 'lifecycle_deletion_pending');--> statement-breakpoint
CREATE TYPE "public"."domain_audit_actor_type" AS ENUM('user', 'system', 'worker');--> statement-breakpoint
CREATE TYPE "public"."domain_audit_domain" AS ENUM('ownership', 'permissions', 'moderation', 'result', 'evidence', 'data_lifecycle', 'admin');--> statement-breakpoint
CREATE TABLE "domain_audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_type" "domain_audit_actor_type" DEFAULT 'user' NOT NULL,
	"domain" "domain_audit_domain" NOT NULL,
	"action_type" "domain_audit_action_type" NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"outcome" text,
	"reason" text,
	"metadata" jsonb,
	"linked_case_id" uuid,
	"linked_scrim_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "domain_audit_event_actor_idx" ON "domain_audit_event" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "domain_audit_event_domain_idx" ON "domain_audit_event" USING btree ("domain","action_type","created_at");--> statement-breakpoint
CREATE INDEX "domain_audit_event_target_idx" ON "domain_audit_event" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "domain_audit_event_case_idx" ON "domain_audit_event" USING btree ("linked_case_id");--> statement-breakpoint
CREATE INDEX "domain_audit_event_scrim_idx" ON "domain_audit_event" USING btree ("linked_scrim_id");--> statement-breakpoint
CREATE INDEX "domain_audit_event_created_idx" ON "domain_audit_event" USING btree ("created_at");