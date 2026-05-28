CREATE TYPE "public"."report_category" AS ENUM('harassment', 'spam', 'impersonation', 'abuse', 'evidence_manipulation', 'dispute_abuse', 'suspicious_recruiting', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'under_review', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target_type" AS ENUM('user', 'team', 'organization', 'listing', 'message', 'scrim', 'update', 'ocr_evidence');--> statement-breakpoint
CREATE TABLE "user_report_supplement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"author_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" "report_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"category" "report_category" NOT NULL,
	"reason" text NOT NULL,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"target_snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_report_supplement" ADD CONSTRAINT "user_report_supplement_report_id_user_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."user_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_report_supplement" ADD CONSTRAINT "user_report_supplement_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_report_supplement_report_idx" ON "user_report_supplement" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "user_report_reporter_idx" ON "user_report" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "user_report_target_idx" ON "user_report" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_report_status_idx" ON "user_report" USING btree ("status");