import type {
	AvailabilityRow,
	NotificationSummary,
	OrgInviteSummary,
	OrgPendingInvite,
	OrgWorkspaceDetail,
	PublicPlayerDetail,
	PublicPlayerSummary,
	RecruitmentApplicationSummary,
	RecruitmentConversationSummary,
	RecruitmentListingSummary,
	RecruitmentMessage,
	RosterMember,
	Session,
	TeamAdminSummary,
	TeamInviteSummary,
	TeamPendingInvite,
	TeamWorkspaceDetail,
} from "./types";

// Compile-time guardrail: transport DTOs must not contain raw Date objects.
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
type _OrgWorkspaceDetailNoDate = AssertNoDate<ContainsDate<OrgWorkspaceDetail>>;
type _RecruitmentListingSummaryNoDate = AssertNoDate<ContainsDate<RecruitmentListingSummary>>;
type _RecruitmentApplicationSummaryNoDate = AssertNoDate<
	ContainsDate<RecruitmentApplicationSummary>
>;
type _RecruitmentConversationSummaryNoDate = AssertNoDate<
	ContainsDate<RecruitmentConversationSummary>
>;
type _RecruitmentMessageNoDate = AssertNoDate<ContainsDate<RecruitmentMessage>>;
type _NotificationSummaryNoDate = AssertNoDate<ContainsDate<NotificationSummary>>;
type _AvailabilityRowNoDate = AssertNoDate<ContainsDate<AvailabilityRow>>;
type _TeamAdminSummaryNoDate = AssertNoDate<ContainsDate<TeamAdminSummary>>;
type _TeamWorkspaceDetailNoDate = AssertNoDate<ContainsDate<TeamWorkspaceDetail>>;
type _PublicPlayerSummaryNoDate = AssertNoDate<ContainsDate<PublicPlayerSummary>>;
type _PublicPlayerDetailNoDate = AssertNoDate<ContainsDate<PublicPlayerDetail>>;
