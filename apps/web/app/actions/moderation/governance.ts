"use server";

import type { ModeratorOwnershipResolutionInput } from "@scrimflow/shared";
import { apiPost } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export interface GovernanceActionResult {
	success?: boolean;
	error?: string;
}

export async function resolveOwnershipByModeratorAction(
	workflowId: string,
	input: ModeratorOwnershipResolutionInput
): Promise<GovernanceActionResult> {
	const res = await apiPost(apiRoutes.moderation.governance.resolveOwnership(workflowId), input);
	if ("error" in res) return { error: res.error };
	return { success: true };
}
