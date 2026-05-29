"use server";

import type { FormActionResult } from "@/hooks/use-form-action";
import { isApiActionError, toFormActionError } from "@/lib/action-result";
import { apiPatch } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export async function moderationCaseAction(
	reportId: string,
	payload: Record<string, unknown>
): Promise<FormActionResult> {
	const result = await apiPatch(apiRoutes.moderation.report(reportId), payload);
	if (isApiActionError(result)) return toFormActionError(result);
	return { success: true };
}
