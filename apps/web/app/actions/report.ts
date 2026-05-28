"use server";

import type { FormActionResult } from "@/hooks/use-form-action";
import { isApiActionError, toFormActionError } from "@/lib/action-result";
import { apiPost } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export async function submitReportAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { reportId?: string; reportStatus?: string }> {
	const result = await apiPost<{ reportId: string; status: string }>(apiRoutes.reports.root, {
		targetType: formData.get("targetType"),
		targetId: formData.get("targetId"),
		category: formData.get("category"),
		reason: formData.get("reason"),
	});
	if (isApiActionError(result)) return toFormActionError(result);
	return { success: true, reportId: result.reportId, reportStatus: result.status };
}
