import type { UserSearchResult } from "@scrimflow/shared";
import { apiGet } from "@/lib/api-client";

export type { UserSearchResult };

export async function searchUsers(
	query: string,
	options?: { excludeTeamId?: string }
): Promise<UserSearchResult[]> {
	const q = query.trim();
	if (q.length < 2) return [];

	const params = new URLSearchParams({ q });
	if (options?.excludeTeamId) params.set("excludeTeamId", options.excludeTeamId);

	const res = await apiGet<UserSearchResult[]>(`/api/users/search?${params.toString()}`);
	if ("data" in res) return res.data;
	return [];
}
