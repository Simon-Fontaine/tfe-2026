import * as v from "valibot";
import { OCR_SCREENSHOT_TYPE_VALUES } from "./ocr";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const CreateScrimEvidenceUploadIntentSchema = v.object({
	scrimId: v.pipe(v.string(), v.uuid("Invalid scrim ID")),
	screenshotType: v.picklist(OCR_SCREENSHOT_TYPE_VALUES, "Invalid screenshot type"),
	scrimMapId: v.optional(v.pipe(v.string(), v.uuid("Invalid scrim map ID"))),
	fileName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(180)),
	contentType: v.picklist(ALLOWED_IMAGE_TYPES, "Invalid content type"),
	sizeBytes: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8 * 1024 * 1024)),
});

export type CreateScrimEvidenceUploadIntentInput = v.InferOutput<
	typeof CreateScrimEvidenceUploadIntentSchema
>;

export const FinalizeScrimEvidenceUploadSchema = v.object({
	scrimId: v.pipe(v.string(), v.uuid("Invalid scrim ID")),
	screenshotType: v.picklist(OCR_SCREENSHOT_TYPE_VALUES, "Invalid screenshot type"),
	scrimMapId: v.optional(v.pipe(v.string(), v.uuid("Invalid scrim map ID"))),
	objectKey: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(400)),
});

export type FinalizeScrimEvidenceUploadInput = v.InferOutput<
	typeof FinalizeScrimEvidenceUploadSchema
>;
