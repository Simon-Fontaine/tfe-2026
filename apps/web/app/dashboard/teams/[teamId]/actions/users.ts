"use server";

import { searchUsers } from "@/lib/data/users";

export async function searchUsersForTeamAction(query: string, teamId: string) {
	return searchUsers(query, { excludeTeamId: teamId });
}
