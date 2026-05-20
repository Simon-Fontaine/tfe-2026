const TEAM_NAME_CONFLICT_MESSAGE =
	"Another active team in this organization already uses this name.";
const TEAM_TAG_CONFLICT_MESSAGE = "Another active team in this organization already uses this tag.";

export type TeamIdentity = {
	name: string;
	tag: string;
};

export type TeamIdentityFieldErrors = Partial<Record<keyof TeamIdentity, string[]>>;

export function normalizeTeamIdentity(identity: TeamIdentity): TeamIdentity {
	return {
		name: identity.name.trim(),
		tag: identity.tag.trim().toUpperCase(),
	};
}

export function getTeamIdentityFieldErrors(
	inputIdentity: TeamIdentity,
	existingIdentities: TeamIdentity | TeamIdentity[]
): TeamIdentityFieldErrors {
	const input = normalizeTeamIdentity(inputIdentity);
	const existingList = Array.isArray(existingIdentities)
		? existingIdentities
		: [existingIdentities];
	const fieldErrors: TeamIdentityFieldErrors = {};

	for (const existingIdentity of existingList) {
		const existing = normalizeTeamIdentity(existingIdentity);
		if (input.name.toLowerCase() === existing.name.toLowerCase()) {
			fieldErrors.name = [TEAM_NAME_CONFLICT_MESSAGE];
		}
		if (input.tag === existing.tag) {
			fieldErrors.tag = [TEAM_TAG_CONFLICT_MESSAGE];
		}
	}

	return fieldErrors;
}

export function getTeamIdentityConstraintFieldErrors(
	constraintName: string | undefined
): TeamIdentityFieldErrors | null {
	if (constraintName === "team_org_active_name_unique_idx") {
		return { name: [TEAM_NAME_CONFLICT_MESSAGE] };
	}
	if (constraintName === "team_org_active_tag_unique_idx") {
		return { tag: [TEAM_TAG_CONFLICT_MESSAGE] };
	}
	return null;
}
