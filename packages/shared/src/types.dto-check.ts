import type {
	AvailabilityRow,
	LfgApplicationSummary,
	LfgPostSummary,
	NotificationSummary,
	OrgInviteSummary,
	OrgPendingInvite,
	RosterMember,
	Session,
	TeamInviteSummary,
	TeamPendingInvite,
	UserApplicationSummary,
} from "./types";

// Compile-time guardrail: transport DTOs should never contain raw Date objects.
// If one slips in, one of the assertions below will fail during type-check.
type ContainsDate<T> = T extends Date
	? true
	: T extends (...args: never[]) => unknown
		? false
		: T extends readonly (infer U)[]
			? ContainsDate<U>
			: T extends object
				? { [K in keyof T]-?: ContainsDate<T[K]> }[keyof T]
				: false;

type AssertNoDate<T extends false> = T;

type _SessionNoDate = AssertNoDate<ContainsDate<Session>>;
type _RosterMemberNoDate = AssertNoDate<ContainsDate<RosterMember>>;
type _TeamInviteSummaryNoDate = AssertNoDate<ContainsDate<TeamInviteSummary>>;
type _TeamPendingInviteNoDate = AssertNoDate<ContainsDate<TeamPendingInvite>>;
type _OrgInviteSummaryNoDate = AssertNoDate<ContainsDate<OrgInviteSummary>>;
type _OrgPendingInviteNoDate = AssertNoDate<ContainsDate<OrgPendingInvite>>;
type _LfgPostSummaryNoDate = AssertNoDate<ContainsDate<LfgPostSummary>>;
type _LfgApplicationSummaryNoDate = AssertNoDate<ContainsDate<LfgApplicationSummary>>;
type _UserApplicationSummaryNoDate = AssertNoDate<ContainsDate<UserApplicationSummary>>;
type _NotificationSummaryNoDate = AssertNoDate<ContainsDate<NotificationSummary>>;
type _AvailabilityRowNoDate = AssertNoDate<ContainsDate<AvailabilityRow>>;
