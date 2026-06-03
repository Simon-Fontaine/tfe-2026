import { Add01Icon, UserSearch01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { appRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecruitmentListingFormDialog } from "@/components/recruit/recruitment-listing-form-dialog";
import { RecruitmentListingRow } from "@/components/recruit/recruitment-listing-row";
import { Button } from "@/components/ui/button";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { getRecruitmentApplicationsForListing } from "@/lib/data/recruit";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function TeamRecruitingPage({
	params,
}: {
	params: Promise<{ teamId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { teamId } = await params;
	const team = await getTeamWithRosterRouteState(teamId, user.id);
	if (team.kind === "missing") notFound();
	if (team.kind !== "success") {
		return <AccessGate title="Recruiting" resourceType="team" />;
	}
	if (!team.data.currentUser.canViewRecruiting) {
		return <AccessGate title="Recruiting" resourceType="team" />;
	}

	const applicationsByListing = new Map(
		team.data.currentUser.canManageListings
			? await Promise.all(
					team.data.ownedListings.map(async (listing) => {
						const apps = await getRecruitmentApplicationsForListing(listing.id).catch(() => []);
						return [listing.id, apps] as const;
					})
				)
			: []
	);

	const newListingAction = team.data.currentUser.canManage ? (
		<RecruitmentListingFormDialog
			fixedOwnerType="team"
			fixedTeamId={team.data.id}
			triggerContent={
				<>
					<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
					New listing
				</>
			}
		/>
	) : undefined;

	return (
		<PageContainer>
			<PageHeader
				title="Recruiting"
				breadcrumbs={
					<>
						<Link href="/app" className="hover:underline">
							Teams
						</Link>
						{" / "}
						<Link href={appRoutes.teams.byId(team.data.id)} className="hover:underline">
							{team.data.name}
						</Link>
						{" / Recruiting"}
					</>
				}
				action={newListingAction}
			/>

			{team.data.currentUser.canManage && (
				<div className="mb-4 flex justify-end">
					<Button asChild variant="outline" size="sm">
						<Link href={appRoutes.recruiting.conversations}>View conversations</Link>
					</Button>
				</div>
			)}

			{team.data.ownedListings.length === 0 ? (
				<EmptyState
					icon={UserSearch01Icon}
					title="No team listings yet."
					action={
						team.data.currentUser.canManage ? (
							<RecruitmentListingFormDialog
								fixedOwnerType="team"
								fixedTeamId={team.data.id}
								triggerContent="Create listing"
							/>
						) : undefined
					}
				/>
			) : (
				<div className="divide-y border">
					{team.data.ownedListings.map((listing) => (
						<RecruitmentListingRow
							key={listing.id}
							listing={listing}
							applications={applicationsByListing.get(listing.id) ?? []}
							teamId={team.data.id}
							organizationId={team.data.organizationId}
							canManage={team.data.currentUser.canManageListings}
							conversationHrefBase={appRoutes.recruiting.conversations}
						/>
					))}
				</div>
			)}
		</PageContainer>
	);
}
