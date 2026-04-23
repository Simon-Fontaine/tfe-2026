import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";
import { RecruitmentListingCard } from "@/components/recruit/recruitment-listing-card";
import { RecruitmentListingFormDialog } from "@/components/recruit/recruitment-listing-form-dialog";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getRecruitmentApplicationsForListing } from "@/lib/data/recruit";
import { getTeamWithRoster } from "@/lib/data/teams";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function TeamRecruitingPage({
	params,
}: {
	params: Promise<{ teamId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { teamId } = await params;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) notFound();

	const applicationsByListing = new Map(
		await Promise.all(
			team.ownedListings.map(
				async (listing) =>
					[listing.id, await getRecruitmentApplicationsForListing(listing.id)] as const
			)
		)
	);

	return (
		<PageContainer>
			<PageHeader
				title="Recruiting"
				description={`Manage ${team.name}'s player, ringer, and staff listings from one team workspace.`}
				actions={
					team.currentUser.canManage ? (
						<RecruitmentListingFormDialog
							fixedOwnerType="team"
							fixedTeamId={team.id}
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

			{team.ownedListings.length === 0 ? (
				<EmptyStateBlock
					title="No team listings yet"
					description={
						team.currentUser.canManage
							? "Create a recruiting listing here to replace scattered team outreach."
							: "This team has not published any recruiting listings yet."
					}
					variant="card"
				/>
			) : (
				<div className="space-y-4">
					{team.ownedListings.map((listing) => (
						<RecruitmentListingCard
							key={listing.id}
							listing={listing}
							currentUserId={user.id}
							applications={applicationsByListing.get(listing.id) ?? []}
							teamId={team.id}
							organizationId={team.organizationId}
							conversationHrefBase={appRoutes.recruiting.conversations}
						/>
					))}
				</div>
			)}
		</PageContainer>
	);
}
