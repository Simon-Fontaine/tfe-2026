import type {
	AvailabilityRow,
	NotificationSummary,
	OrgInviteSummary,
	OrgJoinRequestSummary,
	OrgPendingInvite,
	OrgWorkspaceDetail,
	PublicPlayerDetail,
	PublicPlayerSummary,
	RecruitmentConversationSummary,
	RecruitmentMessage,
	RecruitmentPostSummary,
	RecruitmentResponseSummary,
	RecruitmentThread,
	RosterMember,
	Session,
	TeamAdminSummary,
	TeamInviteSummary,
	TeamJoinRequestSummary,
	TeamPendingInvite,
	TeamWorkspaceDetail,
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
type _OrgJoinRequestSummaryNoDate = AssertNoDate<ContainsDate<OrgJoinRequestSummary>>;
type _OrgWorkspaceDetailNoDate = AssertNoDate<ContainsDate<OrgWorkspaceDetail>>;
type _RecruitmentPostSummaryNoDate = AssertNoDate<ContainsDate<RecruitmentPostSummary>>;
type _RecruitmentResponseSummaryNoDate = AssertNoDate<ContainsDate<RecruitmentResponseSummary>>;
type _RecruitmentConversationSummaryNoDate = AssertNoDate<
	ContainsDate<RecruitmentConversationSummary>
>;
type _RecruitmentMessageNoDate = AssertNoDate<ContainsDate<RecruitmentMessage>>;
type _RecruitmentThreadNoDate = AssertNoDate<ContainsDate<RecruitmentThread>>;
type _NotificationSummaryNoDate = AssertNoDate<ContainsDate<NotificationSummary>>;
type _AvailabilityRowNoDate = AssertNoDate<ContainsDate<AvailabilityRow>>;
type _TeamAdminSummaryNoDate = AssertNoDate<ContainsDate<TeamAdminSummary>>;
type _TeamJoinRequestSummaryNoDate = AssertNoDate<ContainsDate<TeamJoinRequestSummary>>;
type _TeamWorkspaceDetailNoDate = AssertNoDate<ContainsDate<TeamWorkspaceDetail>>;
type _PublicPlayerSummaryNoDate = AssertNoDate<ContainsDate<PublicPlayerSummary>>;
type _PublicPlayerDetailNoDate = AssertNoDate<ContainsDate<PublicPlayerDetail>>;
