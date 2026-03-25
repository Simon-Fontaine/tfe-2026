import type {
	RecruitmentPostCategory,
	RecruitmentPostSummary,
	RecruitmentResponseSummary,
	StaffRole,
} from "@scrimflow/shared";

export type RecruitEntityOption = {
	id: string;
	type: "team" | "organization";
	label: string;
	organizationId?: string;
};

export const RECRUITMENT_CATEGORY_LABELS: Record<RecruitmentPostCategory, string> = {
	lft: "LFT",
	lfp: "LFP",
	lfr: "LFR",
	lfs: "LFS",
};

export const RECRUITMENT_CATEGORY_DESCRIPTIONS: Record<RecruitmentPostCategory, string> = {
	lft: "Player looking for a team",
	lfp: "Team looking for a player",
	lfr: "Team looking for a ringer",
	lfs: "Staff opening or staff availability",
};

export const ROLE_LABELS: Record<"tank" | "damage" | "support", string> = {
	tank: "Tank",
	damage: "DPS",
	support: "Support",
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
	coach: "Coach",
	analyst: "Analyst",
	manager: "Manager",
	staff: "Staff",
};

export const MEMBER_TYPE_LABELS: Record<"player" | "staff", string> = {
	player: "Player",
	staff: "Staff",
};

export const RANK_LABELS: Record<string, string> = {
	bronze: "Bronze",
	silver: "Silver",
	gold: "Gold",
	platinum: "Platinum",
	diamond: "Diamond",
	master: "Master",
	grandmaster: "Grandmaster",
	champion: "Champion",
};

export function formatRecruitmentOwner(post: RecruitmentPostSummary) {
	if (post.teamName && post.teamTag) return `[${post.teamTag}] ${post.teamName}`;
	if (post.organizationName) return post.organizationName;
	return post.ownerDisplayName;
}

export function formatRecruitmentAudience(post: RecruitmentPostSummary) {
	if (post.memberType === "staff") {
		return post.staffRole ? STAFF_ROLE_LABELS[post.staffRole] : "Staff";
	}

	if (post.gameRoles.length === 0) return "Any role";
	return post.gameRoles.map((role) => ROLE_LABELS[role]).join(" / ");
}

export function formatRecruitmentCompRange(post: RecruitmentPostSummary) {
	if (post.minSr !== null || post.maxSr !== null) {
		return [post.minSr ? `SR ${post.minSr}` : null, post.maxSr ? `SR ${post.maxSr}` : null]
			.filter(Boolean)
			.join(" - ");
	}

	if (post.minRank || post.maxRank) {
		return [
			post.minRank ? (RANK_LABELS[post.minRank] ?? post.minRank) : null,
			post.maxRank ? (RANK_LABELS[post.maxRank] ?? post.maxRank) : null,
		]
			.filter(Boolean)
			.join(" - ");
	}

	return null;
}

export function getDefaultCategoryForOwner(ownerType: "player" | "team" | "organization") {
	if (ownerType === "player") return "lft";
	if (ownerType === "organization") return "lfs";
	return "lfp";
}

export function categoryMatchesOwner(
	category: RecruitmentPostCategory,
	ownerType: "player" | "team" | "organization"
) {
	if (category === "lft") return ownerType === "player";
	if (category === "lfp" || category === "lfr") return ownerType === "team";
	if (category === "lfs") return true;
	return true;
}

export function getDefaultMemberTypeForCategory(category: RecruitmentPostCategory) {
	return category === "lfs" ? "staff" : "player";
}

export function getPostResponseLabel(post: RecruitmentPostSummary) {
	switch (post.category) {
		case "lft":
			return "Reach out";
		case "lfp":
			return "Apply";
		case "lfr":
			return "Offer availability";
		case "lfs":
			return post.ownerType === "player" ? "Contact" : "Apply";
		default:
			return "Respond";
	}
}

export function getResponseAcceptLabel(response: RecruitmentResponseSummary) {
	switch (response.postCategory) {
		case "lfr":
			return "Accept contact";
		case "lfs":
			return "Accept staff";
		default:
			return "Accept";
	}
}
