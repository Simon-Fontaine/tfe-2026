import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { PendingInviteCard } from "@/components/invites/pending-invite-card";
import { SettingsHeaderBar } from "@/components/settings/settings-header-bar";
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
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<SettingsHeaderBar
				backHref="/dashboard"
				icon={Mail01Icon}
				title="Recruit Invitations"
				subtitle="Invite lifecycle: pending, accepted, declined, expired"
			/>

			<div className="flex flex-wrap items-center gap-2">
				{INVITE_STATUS_FILTERS.map((status) => (
					<Link
						key={status}
						href={
							status === "all"
								? "/dashboard/discover/invitations"
								: `/dashboard/discover/invitations?status=${status}`
						}
					>
						<Badge variant={filter === status ? "default" : "outline"} className="capitalize">
							{status}
						</Badge>
					</Link>
				))}
			</div>

			{total === 0 ? (
				<div className="flex flex-col items-center justify-center border border-dashed px-6 py-16 text-center">
					<HugeiconsIcon
						icon={Mail01Icon}
						strokeWidth={1.5}
						className="mb-4 size-10 text-muted-foreground/40"
					/>
					<p className="text-sm font-medium">No invites match this filter</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Try another status filter to see invite history.
					</p>
				</div>
			) : (
				<div className="space-y-6">
					{filteredTeamInvites.length > 0 && (
						<section className="space-y-3">
							<p className="text-sm font-medium">Team invites</p>
							{filteredTeamInvites.map((invite) => (
								<PendingInviteCard key={invite.id} invite={invite} type="team" />
							))}
						</section>
					)}

					{filteredOrgInvites.length > 0 && (
						<section className="space-y-3">
							<p className="text-sm font-medium">Organisation invites</p>
							{filteredOrgInvites.map((invite) => (
								<PendingInviteCard key={invite.id} invite={invite} type="org" />
							))}
						</section>
					)}
				</div>
			)}
		</div>
	);
}
