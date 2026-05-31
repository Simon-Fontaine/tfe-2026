ALTER TABLE "ocr_job" ADD COLUMN "scrim_map_id" uuid;--> statement-breakpoint
ALTER TABLE "ocr_job" ADD CONSTRAINT "ocr_job_scrim_map_id_scrim_map_id_fk" FOREIGN KEY ("scrim_map_id") REFERENCES "public"."scrim_map"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ocr_job_map_idx" ON "ocr_job" USING btree ("scrim_map_id");