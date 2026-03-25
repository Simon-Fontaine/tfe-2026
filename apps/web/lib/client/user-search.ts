import type { UserSearchResult } from "@scrimflow/shared";

type UserSearchResponse = { data?: UserSearchResult[] };

export async function searchUsers(
	query: string,
	options?: { excludeTeamId?: string }
): Promise<UserSearchResult[]> {
	const params = new URLSearchParams();
	params.set("q", query);
	if (options?.excludeTeamId) params.set("excludeTeamId", options.excludeTeamId);

	const res = await fetch(`/api/users/search?${params.toString()}`);
	if (!res.ok) return [];

	const json = (await res.json().catch(() => null)) as UserSearchResponse | null;
	return json?.data ?? [];
}
