CREATE TABLE "onboarding_draft" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_step" text DEFAULT 'battletag' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_profile" ADD COLUMN "participation_intent" text DEFAULT 'find_team' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profile" ADD COLUMN "availability_intent" text DEFAULT 'not_sure' NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_draft" ADD CONSTRAINT "onboarding_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onboarding_draft_updated_idx" ON "onboarding_draft" USING btree ("updated_at");
