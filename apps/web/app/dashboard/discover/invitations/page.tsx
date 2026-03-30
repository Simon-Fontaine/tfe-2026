import { Mail01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSection } from "@/components/dashboard/page-section";
import { PendingInviteCard } from "@/components/invites/pending-invite-card";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { getCurrentSession } from "@/lib/auth/session";
import { getPendingOrgInvitesForUser } from "@/lib/data/organization";
import { getPendingTeamInvitesForUser } from "@/lib/data/team";

const INVITE_STATUS_FILTERS = ["all", "pending", "accepted", "declined", "expired"] as const;
type InviteStatusFilter = (typeof INVITE_STATUS_FILTERS)[number];

interface InvitesPageProps {
	searchParams: Promise<{ status?: string }>;
}

export default async function InvitesPage({ searchParams }: InvitesPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const [{ status: statusParam }, teamInvites, orgInvites] = await Promise.all([
		searchParams,
		getPendingTeamInvitesForUser(user.id),
		getPendingOrgInvitesForUser(user.id),
	]);

	const filter: InviteStatusFilter = INVITE_STATUS_FILTERS.includes(
		statusParam as InviteStatusFilter
	)
		? (statusParam as InviteStatusFilter)
		: "all";

	const filteredTeamInvites =
		filter === "all" ? teamInvites : teamInvites.filter((invite) => invite.status === filter);
	const filteredOrgInvites =
		filter === "all" ? orgInvites : orgInvites.filter((invite) => invite.status === filter);

	const total = filteredTeamInvites.length + filteredOrgInvites.length;

	return (
		<PageContainer>
			<PageHeader
				title="Invitations"
				description="Invite lifecycle: pending, accepted, declined, expired"
			/>

			<div className="flex flex-wrap items-center gap-2">
				{INVITE_STATUS_FILTERS.map((status) => (
					<Link
						key={status}
						href={
							status === "all"
								? "/dashboard/invitations"
								: `/dashboard/invitations?status=${status}`
						}
					>
						<Badge variant={filter === status ? "default" : "outline"} className="capitalize">
							{status}
						</Badge>
					</Link>
				))}
			</div>

			{total === 0 ? (
				<EmptyStateBlock
					icon={Mail01Icon}
					title="No invites match this filter"
					description="Try another status filter to see invite history."
					variant="card"
				/>
			) : (
				<div className="space-y-6">
					{filteredTeamInvites.length > 0 && (
						<PageSection title="Team invites">
							{filteredTeamInvites.map((invite) => (
								<PendingInviteCard key={invite.id} invite={invite} type="team" />
							))}
						</PageSection>
					)}

					{filteredOrgInvites.length > 0 && (
						<PageSection title="Organisation invites">
							{filteredOrgInvites.map((invite) => (
								<PendingInviteCard key={invite.id} invite={invite} type="org" />
							))}
						</PageSection>
					)}
				</div>
			)}
		</PageContainer>
	);
}
