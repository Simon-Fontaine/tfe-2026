import * as v from "valibot";

export const PROFILE_VISIBILITY_VALUES = ["public", "teams_only", "private"] as const;
export const PRIVACY_VISIBILITY_VALUES = ["public", "teams_only", "private"] as const;
export const NOTIFICATION_OPTIONAL_CATEGORY_VALUES = [
	"invites",
	"applications",
	"scrimChanges",
	"chatActivity",
	"results",
	"disputes",
	"updates",
] as const;
export const MANDATORY_NOTIFICATION_CATEGORY_VALUES = [
	"accountLifecycle",
	"securityCritical",
	"moderationCritical",
] as const;

export const PersonalPrivacySettingsSchema = v.object({
	profileVisibility: v.picklist(PROFILE_VISIBILITY_VALUES, "Please select profile visibility"),
	availabilityVisibility: v.picklist(
		PRIVACY_VISIBILITY_VALUES,
		"Please select availability visibility"
	),
	recruitingDiscoverability: v.boolean("Please choose recruiting discoverability"),
	publicHistoryVisibility: v.picklist(
		PRIVACY_VISIBILITY_VALUES,
		"Please select public history visibility"
	),
});

export const NotificationPreferenceSchema = v.object({
	invites: v.boolean(),
	applications: v.boolean(),
	scrimChanges: v.boolean(),
	chatActivity: v.boolean(),
	results: v.boolean(),
	disputes: v.boolean(),
	updates: v.boolean(),
});

export const DataExportStatusSchema = v.object({
	status: v.picklist(["available", "pending", "completed", "failed"] as const),
	mode: v.picklist(["immediate_download", "async_request"] as const),
	requestedAt: v.nullable(v.string()),
	completedAt: v.nullable(v.string()),
	downloadUrl: v.nullable(v.string()),
});

export const AccountLifecycleStateSchema = v.object({
	deletion: v.object({
		status: v.picklist(["none", "pending", "cancelled", "failed"] as const),
		isPending: v.boolean(),
		scheduledAt: v.nullable(v.string()),
		cancelledAt: v.nullable(v.string()),
		failedAt: v.nullable(v.string()),
	}),
	dataExport: DataExportStatusSchema,
});

export type PersonalPrivacySettingsInput = v.InferOutput<typeof PersonalPrivacySettingsSchema>;
export type NotificationPreferenceInput = v.InferOutput<typeof NotificationPreferenceSchema>;
export type DataExportStatusInput = v.InferOutput<typeof DataExportStatusSchema>;
export type AccountLifecycleStateInput = v.InferOutput<typeof AccountLifecycleStateSchema>;
