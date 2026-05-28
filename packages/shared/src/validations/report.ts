import * as v from "valibot";

const REPORT_CATEGORY_VALUES = [
	"harassment",
	"spam",
	"impersonation",
	"abuse",
	"evidence_manipulation",
	"dispute_abuse",
	"suspicious_recruiting",
	"other",
] as const;

const REPORT_TARGET_TYPE_VALUES = [
	"user",
	"team",
	"organization",
	"listing",
	"message",
	"scrim",
	"update",
	"ocr_evidence",
] as const;

export const SubmitReportSchema = v.object({
	targetType: v.picklist(REPORT_TARGET_TYPE_VALUES, "Invalid target type"),
	targetId: v.pipe(v.string(), v.uuid("Invalid target ID")),
	category: v.picklist(REPORT_CATEGORY_VALUES, "Please select a category"),
	reason: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(10, "Reason must be at least 10 characters"),
		v.maxLength(1000, "Reason cannot exceed 1000 characters")
	),
});

export type SubmitReportInput = v.InferOutput<typeof SubmitReportSchema>;

export const AddReportSupplementSchema = v.object({
	content: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(5, "Supplement must be at least 5 characters"),
		v.maxLength(500, "Supplement cannot exceed 500 characters")
	),
});

export type AddReportSupplementInput = v.InferOutput<typeof AddReportSupplementSchema>;
