import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";
import { RecruitmentListingCard } from "@/components/recruit/recruitment-listing-card";
import { RecruitmentListingFormDialog } from "@/components/recruit/recruitment-listing-form-dialog";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getRecruitmentApplicationsForListing } from "@/lib/data/recruit";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { appRoutes } from "@/lib/routes";
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
		return (
			<PageContainer>
				<PageHeader
					title="Recruiting"
					detail={`Team ${teamId}`}
					description="Team-owned listings and applicant review live in this workspace."
				/>
				<EmptyStateBlock
					title="No access"
					description="You need an active team membership before you can review this team's recruiting workspace."
					variant="card"
				/>
			</PageContainer>
		);
	}

	const applicationsByListing = new Map(
		await Promise.all(
			team.data.ownedListings.map(
				async (listing) =>
					[listing.id, await getRecruitmentApplicationsForListing(listing.id)] as const
			)
		)
	);

	return (
		<PageContainer>
			<PageHeader
				title="Recruiting"
				detail={`[${team.data.tag}] ${team.data.name}`}
				description={`Manage ${team.data.name}'s player, ringer, and staff listings from one team workspace.`}
				actions={
					team.data.currentUser.canManage ? (
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
					) : undefined
				}
			/>

			{team.data.ownedListings.length === 0 ? (
				<EmptyStateBlock
					title="No team listings yet"
					description={
						team.data.currentUser.canManage
							? "Create a recruiting listing to find players, ringers, or staff."
							: "This team hasn't published any recruiting listings yet."
					}
					variant="card"
				/>
			) : (
				<div className="space-y-4">
					{team.data.ownedListings.map((listing) => (
						<RecruitmentListingCard
							key={listing.id}
							listing={listing}
							currentUserId={user.id}
							applications={applicationsByListing.get(listing.id) ?? []}
							teamId={team.data.id}
							organizationId={team.data.organizationId}
							conversationHrefBase={appRoutes.recruiting.conversations}
						/>
					))}
				</div>
			)}
		</PageContainer>
	);
}
