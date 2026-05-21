ALTER TABLE "organization" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_name_unique_idx" ON "organization" USING btree (lower("name"));