import { Add01Icon, UserSearch01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecruitmentListingFormDialog } from "@/components/recruit/recruitment-listing-form-dialog";
import { RecruitmentListingRow } from "@/components/recruit/recruitment-listing-row";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { getOrgWithTeamsRouteState } from "@/lib/data/orgs";
import {
	getManageableRecruitEntities,
	getMyRecruitmentListings,
	getRecruitmentApplicationsForListing,
} from "@/lib/data/recruit";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppOrgRecruitingPage({
	params,
}: {
	params: Promise<{ orgId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { orgId } = await params;
	const org = await getOrgWithTeamsRouteState(orgId, user.id);
	if (org.kind === "missing") notFound();
	if (org.kind === "no-access") {
		return <AccessGate title="Recruiting" resourceType="organization" reason={org.reason} />;
	}
	if (org.kind !== "success" || !org.data.currentUser.canManage) {
		return <AccessGate title="Recruiting" resourceType="organization" reason="role" />;
	}
	const orgDetail = org.data;

	const [entityOptions, allManageableListings] = await Promise.all([
		getManageableRecruitEntities(user.id),
		getMyRecruitmentListings(),
	]);

	const listings = allManageableListings.filter(
		(listing) => listing.ownerType === "organization" && listing.organizationId === orgId
	);
	const applicationsByListing = new Map(
		await Promise.all(
			listings.map(async (listing) => {
				const applications = await getRecruitmentApplicationsForListing(listing.id).catch(() => []);
				return [listing.id, applications] as const;
			})
		)
	);

	return (
		<PageContainer>
			<PageHeader
				title="Recruiting"
				breadcrumbs={
					<>
						<Link href={appRoutes.orgs.root} className="hover:underline">
							Orgs
						</Link>
						{" / "}
						<Link href={appRoutes.orgs.byId(orgDetail.id)} className="hover:underline">
							{orgDetail.name}
						</Link>
						{" / Recruiting"}
					</>
				}
				meta={`/${orgDetail.slug} - ${listings.length} listings - ${orgDetail.currentUser.role ?? "member"}`}
				action={
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

			<section className="flex flex-col gap-4">
				<h2 className="mb-4 border-b pb-2 text-lg font-semibold">Organization listings</h2>
				{listings.length === 0 ? (
					<EmptyState icon={UserSearch01Icon} title="No organization listings yet" />
				) : (
					<div className="overflow-hidden border">
						<div className="grid grid-cols-[minmax(12rem,1.5fr)_repeat(6,minmax(5rem,1fr))_3rem] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
							<span>Listing</span>
							<span>Category</span>
							<span>Target</span>
							<span>Status</span>
							<span>Range</span>
							<span>Applications</span>
							<span>Updated</span>
							<span className="text-right">Actions</span>
						</div>
						<div className="divide-y">
							{listings.map((listing) => (
								<RecruitmentListingRow
									key={listing.id}
									listing={listing}
									applications={applicationsByListing.get(listing.id) ?? []}
									organizationId={orgId}
									canManage={org.data.currentUser.canManage}
									conversationHrefBase={appRoutes.recruiting.conversations}
									detailHref={appRoutes.recruiting.byId(listing.id)}
								/>
							))}
						</div>
					</div>
				)}
			</section>
		</PageContainer>
	);
}
