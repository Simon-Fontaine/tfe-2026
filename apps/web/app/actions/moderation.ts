"use server";

import type { CreateModerationActionInput } from "@scrimflow/shared";
import type { FormActionResult } from "@/hooks/use-form-action";
import { isApiActionError, toFormActionError } from "@/lib/action-result";
import { apiPatch, apiPost } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export async function moderationCaseAction(
	reportId: string,
	payload: Record<string, unknown>
): Promise<FormActionResult> {
	const result = await apiPatch(apiRoutes.moderation.report(reportId), payload);
	if (isApiActionError(result)) return toFormActionError(result);
	return { success: true };
}

export async function createModerationAction(
	payload: CreateModerationActionInput
): Promise<FormActionResult> {
	const result = await apiPost(apiRoutes.moderation.actions, payload);
	if (isApiActionError(result)) return toFormActionError(result);
	return { success: true };
}

export async function reverseModerationAction(actionId: string): Promise<FormActionResult> {
	const result = await apiPost(`${apiRoutes.moderation.action(actionId)}/reverse`, {});
	if (isApiActionError(result)) return toFormActionError(result);
	return { success: true };
}
