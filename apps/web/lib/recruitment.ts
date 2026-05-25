import type {
	CreateRecruitmentListingInput,
	RecruitmentApplicationStatus,
	RecruitmentApplicationSummary,
	RecruitmentListingCategory,
	RecruitmentListingStatus,
	RecruitmentListingSummary,
	StaffRole,
} from "@scrimflow/shared";

export type RecruitEntityOption = {
	id: string;
	type: "team" | "organization";
	label: string;
	organizationId?: string;
};

export const RECRUITMENT_CATEGORY_LABELS: Record<RecruitmentListingCategory, string> = {
	lft: "LFT",
	lfp: "LFP",
	lfr: "LFR",
	lfs: "LFS",
};

export const RECRUITMENT_CATEGORY_DESCRIPTIONS: Record<RecruitmentListingCategory, string> = {
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

export type RecruitmentRank = NonNullable<CreateRecruitmentListingInput["minRank"]>;

export const RECRUITMENT_RANK_VALUES = [
	"bronze",
	"silver",
	"gold",
	"platinum",
	"diamond",
	"master",
	"grandmaster",
	"champion",
] as const satisfies readonly RecruitmentRank[];

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

export const APPLICATION_STATUS_LABELS: Record<RecruitmentApplicationStatus, string> = {
	pending: "Pending review",
	accepted: "Accepted",
	rejected: "Not accepted",
	withdrawn: "Withdrawn",
};

export const RECRUITMENT_STATUS_LABELS: Record<RecruitmentListingStatus, string> = {
	open: "Open",
	paused: "Paused",
	closed: "Closed",
	fulfilled: "Fulfilled",
	expired: "Expired",
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

export function getRecruitmentRank(value: string): RecruitmentRank | undefined {
	const normalized = value.trim().toLowerCase();

	if (RECRUITMENT_RANK_VALUES.some((rank) => rank === normalized)) {
		return normalized as RecruitmentRank;
	}

	return undefined;
}

export function formatRecruitmentOwner(listing: RecruitmentListingSummary) {
	if (listing.teamName && listing.teamTag) return `[${listing.teamTag}] ${listing.teamName}`;
	if (listing.organizationName) return listing.organizationName;
	return listing.ownerDisplayName;
}

export function formatRecruitmentAudience(listing: RecruitmentListingSummary) {
	if (listing.memberType === "staff") {
		return listing.staffRole ? STAFF_ROLE_LABELS[listing.staffRole] : "Staff";
	}

	if (listing.gameRoles.length === 0) return "Any role";
	return listing.gameRoles.map((role) => ROLE_LABELS[role]).join(" / ");
}

export function formatRecruitmentCompRange(listing: RecruitmentListingSummary) {
	if (listing.minRating !== null || listing.maxRating !== null) {
		if (listing.minRating !== null && listing.maxRating !== null) {
			return `Rating ${listing.minRating} - ${listing.maxRating}`;
		}

		if (listing.minRating !== null) {
			return `Min rating ${listing.minRating}`;
		}

		if (listing.maxRating !== null) {
			return `Up to rating ${listing.maxRating}`;
		}
	}

	if (listing.minRank || listing.maxRank) {
		return [
			listing.minRank ? (RANK_LABELS[listing.minRank] ?? listing.minRank) : null,
			listing.maxRank ? (RANK_LABELS[listing.maxRank] ?? listing.maxRank) : null,
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
	category: RecruitmentListingCategory,
	ownerType: "player" | "team" | "organization"
) {
	if (category === "lft") return ownerType === "player";
	if (category === "lfp" || category === "lfr") return ownerType === "team";
	if (category === "lfs") return true;
	return true;
}

export function getDefaultMemberTypeForCategory(category: RecruitmentListingCategory) {
	return category === "lfs" ? "staff" : "player";
}

export function getRecruitmentApplicationLabel(listing: RecruitmentListingSummary) {
	switch (listing.category) {
		case "lft":
			return "Reach out";
		case "lfp":
			return "Apply";
		case "lfr":
			return "Offer availability";
		case "lfs":
			return listing.ownerType === "player" ? "Contact" : "Apply";
		default:
			return "Apply";
	}
}

export function getRecruitmentApplicationAcceptLabel(application: RecruitmentApplicationSummary) {
	switch (application.listingCategory) {
		case "lfr":
			return "Accept contact";
		case "lfs":
			return "Accept staff";
		default:
			return "Accept";
	}
}
