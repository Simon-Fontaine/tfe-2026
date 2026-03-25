import * as v from "valibot";
import {
	type CreateRecruitmentPostInput,
	CreateRecruitmentPostSchema,
	type CreateRecruitmentResponseInput,
	CreateRecruitmentResponseSchema,
	type DecideRecruitmentResponseInput,
	DecideRecruitmentResponseSchema,
	type WithdrawRecruitmentResponseInput,
	WithdrawRecruitmentResponseSchema,
} from "./recruit";

export {
	CreateRecruitmentPostSchema,
	CreateRecruitmentResponseSchema,
	DecideRecruitmentResponseSchema,
	WithdrawRecruitmentResponseSchema,
};
export type {
	CreateRecruitmentPostInput,
	CreateRecruitmentResponseInput,
	DecideRecruitmentResponseInput,
	WithdrawRecruitmentResponseInput,
};

export const CreateLfgPostSchema = CreateRecruitmentPostSchema;
export type CreateLfgPostInput = CreateRecruitmentPostInput;

export const CloseLfgPostSchema = v.object({
	postId: v.pipe(v.string(), v.uuid("Invalid post ID")),
});
export type CloseLfgPostInput = v.InferOutput<typeof CloseLfgPostSchema>;

export const ApplyToLfgPostSchema = CreateRecruitmentResponseSchema;
export type ApplyToLfgPostInput = CreateRecruitmentResponseInput;

export const RespondToApplicationSchema = v.object({
	applicationId: v.pipe(v.string(), v.uuid("Invalid application ID")),
	action: v.picklist(["accept", "reject"] as const, "Please select an action"),
	roleInTeam: v.optional(v.picklist(["tank", "damage", "support"] as const, "Invalid role")),
});
export type RespondToApplicationInput = v.InferOutput<typeof RespondToApplicationSchema>;

export const WithdrawApplicationSchema = v.object({
	applicationId: v.pipe(v.string(), v.uuid("Invalid application ID")),
});
export type WithdrawApplicationInput = v.InferOutput<typeof WithdrawApplicationSchema>;
