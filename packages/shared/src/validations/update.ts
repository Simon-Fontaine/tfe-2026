import * as v from "valibot";

const UPDATE_SCOPE_VALUES = ["team", "organization"] as const;
const UPDATE_VISIBILITY_VALUES = ["workspace", "public"] as const;

const optionalUuid = v.optional(v.pipe(v.string(), v.uuid("Invalid ID")));

export const CreateUpdatePostSchema = v.object({
	scopeType: v.picklist(UPDATE_SCOPE_VALUES, "Please select an update scope"),
	teamId: optionalUuid,
	organizationId: optionalUuid,
	visibility: v.picklist(UPDATE_VISIBILITY_VALUES, "Please select a visibility"),
	title: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(3, "Title must be at least 3 characters"),
		v.maxLength(120, "Title cannot exceed 120 characters")
	),
	body: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(10, "Update body must be at least 10 characters"),
		v.maxLength(4000, "Update body cannot exceed 4000 characters")
	),
});

export type CreateUpdatePostInput = v.InferOutput<typeof CreateUpdatePostSchema>;

export const UpdateUpdatePostSchema = v.object({
	updateId: v.pipe(v.string(), v.uuid("Invalid update ID")),
	visibility: v.picklist(UPDATE_VISIBILITY_VALUES, "Please select a visibility"),
	title: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(3, "Title must be at least 3 characters"),
		v.maxLength(120, "Title cannot exceed 120 characters")
	),
	body: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(10, "Update body must be at least 10 characters"),
		v.maxLength(4000, "Update body cannot exceed 4000 characters")
	),
});

export type UpdateUpdatePostInput = v.InferOutput<typeof UpdateUpdatePostSchema>;
