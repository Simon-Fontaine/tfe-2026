-- disable transaction
ALTER TYPE "public"."verification_action" ADD VALUE 'organization_lifecycle_delete';--> statement-breakpoint
ALTER TYPE "public"."verification_action" ADD VALUE 'team_lifecycle_delete';
