import type { UserSearchResult } from "@/lib/data/team";

const ROLE_LABELS = {
	tank: "Tank",
	damage: "DPS",
	support: "Support",
} as const;

const RANK_LABELS: Record<string, string> = {
	bronze: "Bronze",
	silver: "Silver",
	gold: "Gold",
	platinum: "Platinum",
	diamond: "Diamond",
	master: "Master",
	grandmaster: "Grandmaster",
	champion: "Champion",
};

export function renderOw2RoleRankMeta(user: UserSearchResult) {
	if (!user.primaryRole && !user.rank) return null;

	return (
		<>
			{user.primaryRole && ROLE_LABELS[user.primaryRole]}
			{user.rank && ` · ${RANK_LABELS[user.rank] ?? user.rank}`}
		</>
	);
}
