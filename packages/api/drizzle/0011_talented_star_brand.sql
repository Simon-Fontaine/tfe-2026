ALTER TABLE "recruitment_application" ADD COLUMN "reviewer_notes" text;--> statement-breakpoint
ALTER TABLE "recruitment_application" ADD COLUMN "is_shortlisted" boolean DEFAULT false NOT NULL;