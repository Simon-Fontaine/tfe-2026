import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	OrgWorkspaceMissingState,
	OrgWorkspaceNoAccessState,
} from "@/components/orgs/org-workspace-state";
import { RecruitmentListingCard } from "@/components/recruit/recruitment-listing-card";
import { RecruitmentListingFormDialog } from "@/components/recruit/recruitment-listing-form-dialog";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";
import {
	getManageableRecruitEntities,
	getMyRecruitmentListings,
	getRecruitmentApplicationsForListing,
} from "@/lib/data/recruit";
import { appRoutes } from "@/lib/routes";

export default async function AppOrgRecruitingPage({
	params,
}: {
	params: Promise<{ orgId: string }>;
}) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) return <OrgWorkspaceMissingState />;
	if (!org.currentUser.canManage) {
		return (
			<OrgWorkspaceNoAccessState
				title="Recruiting"
				description="You don't have permission to manage this organisation's recruiting workspace."
			/>
		);
	}

	const [entityOptions, allManageableListings] = await Promise.all([
		getManageableRecruitEntities(user.id),
		getMyRecruitmentListings(),
	]);

	const listings = allManageableListings.filter(
		(listing) => listing.ownerType === "organization" && listing.organizationId === orgId
	);
	const applicationsByListing = new Map(
		await Promise.all(
			listings.map(
				async (listing) =>
					[listing.id, await getRecruitmentApplicationsForListing(listing.id)] as const
			)
		)
	);

	return (
		<PageContainer>
			<PageHeader
				title="Recruiting"
				description={`Manage recruiting listings owned directly by ${org.name}.`}
				actions={
					<RecruitmentListingFormDialog
						ownerOptions={entityOptions}
						fixedOwnerType="organization"
						fixedOrganizationId={orgId}
						triggerContent={
							<>
								<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								New listing
							</>
						}
					/>
				}
			/>

			<PageSection
				title="Organisation listings"
				description="Org-owned recruiting listings, including entries that are no longer open."
			>
				{listings.length === 0 ? (
					<EmptyStateBlock
						title="No organisation listings yet"
						description="Publish an organisation-owned listing to start managing recruiting from this workspace."
						variant="card"
					/>
				) : (
					<div className="space-y-4">
						{listings.map((listing) => (
							<RecruitmentListingCard
								key={listing.id}
								listing={listing}
								currentUserId={user.id}
								entityOptions={entityOptions}
								applications={applicationsByListing.get(listing.id) ?? []}
								organizationId={orgId}
								conversationHrefBase={appRoutes.recruiting.conversations}
								detailHref={appRoutes.recruiting.byId(listing.id)}
							/>
						))}
					</div>
				)}
			</PageSection>
		</PageContainer>
	);
}
