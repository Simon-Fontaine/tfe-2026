import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecruitmentListingCard } from "@/components/recruit/recruitment-listing-card";
import { RecruitmentListingFormDialog } from "@/components/recruit/recruitment-listing-form-dialog";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
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

			{team.data.currentUser.canManage && (
				<PageSection
					title="Conversations"
					description="Open recruiting conversations for this team."
				>
					<Button asChild variant="outline" size="sm">
						<Link href={appRoutes.recruiting.conversations}>View recruiting conversations</Link>
					</Button>
				</PageSection>
			)}

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
