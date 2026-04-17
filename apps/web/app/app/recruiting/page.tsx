import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { RecruitingRealtimeBootstrap } from "@/components/recruit/recruiting-realtime-bootstrap";
import { RecruitmentListingCard } from "@/components/recruit/recruitment-listing-card";
import { RecruitmentListingFormDialog } from "@/components/recruit/recruitment-listing-form-dialog";
import { RecruitmentSentApplicationsPanel } from "@/components/recruit/recruitment-sent-applications-panel";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { getCurrentSession } from "@/lib/auth/session";
import {
	getManageableRecruitEntities,
	getMyRecruitmentApplications,
	getMyRecruitmentListings,
	getRecruitmentApplicationsForListing,
	getRecruitmentListings,
} from "@/lib/data/recruit";
import { RECRUITMENT_CATEGORY_LABELS } from "@/lib/recruitment";
import { appRoutes } from "@/lib/routes";

const CATEGORY_FILTERS = ["all", "lft", "lfp", "lfr", "lfs"] as const;

interface AppRecruitingPageProps {
	searchParams: Promise<{ category?: string }>;
}

export default async function AppRecruitingPage({ searchParams }: AppRecruitingPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { category: categoryParam } = await searchParams;
	const category = CATEGORY_FILTERS.includes(
		(categoryParam ?? "all") as (typeof CATEGORY_FILTERS)[number]
	)
		? ((categoryParam ?? "all") as (typeof CATEGORY_FILTERS)[number])
		: "all";

	const [entityOptions, myListings, myApplications, openListings] = await Promise.all([
		getManageableRecruitEntities(user.id),
		getMyRecruitmentListings(),
		getMyRecruitmentApplications(),
		getRecruitmentListings({
			category: category === "all" ? undefined : category,
		}),
	]);

	const myListingIds = new Set(myListings.map((listing) => listing.id));
	const marketplaceListings = openListings.filter((listing) => !myListingIds.has(listing.id));
	const applicationsByListing = new Map(
		await Promise.all(
			myListings.map(
				async (listing) =>
					[listing.id, await getRecruitmentApplicationsForListing(listing.id)] as const
			)
		)
	);

	return (
		<PageContainer>
			<RecruitingRealtimeBootstrap initialPendingCount={0} />
			<PageHeader
				title="Recruiting"
				description="Manage your own recruiting listings, track applications, and browse the wider marketplace from one workspace."
				actions={
					<RecruitmentListingFormDialog
						ownerOptions={entityOptions}
						triggerContent={
							<>
								<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								New listing
							</>
						}
					/>
				}
			>
				<div className="flex flex-wrap gap-2">
					{CATEGORY_FILTERS.map((filter) => (
						<Link
							key={filter}
							href={
								filter === "all"
									? appRoutes.recruiting.root
									: `${appRoutes.recruiting.root}?category=${filter}`
							}
						>
							<Badge variant={category === filter ? "default" : "outline"} className="capitalize">
								{filter === "all" ? "All listings" : RECRUITMENT_CATEGORY_LABELS[filter]}
							</Badge>
						</Link>
					))}
				</div>
			</PageHeader>

			<PageSection
				title="Your listings"
				description="Review incoming applications, update details, and close or delete recruiting listings you manage."
			>
				{myListings.length === 0 ? (
					<EmptyStateBlock
						title="No recruiting listings yet"
						description="Publish your first listing here instead of managing ad hoc Discord threads."
						variant="card"
					/>
				) : (
					<div className="space-y-4">
						{myListings.map((listing) => (
							<RecruitmentListingCard
								key={listing.id}
								listing={listing}
								currentUserId={user.id}
								entityOptions={entityOptions}
								applications={applicationsByListing.get(listing.id) ?? []}
								teamId={listing.teamId ?? undefined}
								organizationId={listing.organizationId ?? undefined}
								conversationHrefBase={appRoutes.recruiting.conversations}
								detailHref={appRoutes.recruiting.byId(listing.id)}
							/>
						))}
					</div>
				)}
			</PageSection>

			<PageSection
				title="Sent applications"
				description="Track every application you have already sent across players, teams, and organizations."
			>
				<RecruitmentSentApplicationsPanel
					applications={myApplications}
					conversationHrefBase={appRoutes.recruiting.conversations}
				/>
			</PageSection>

			<PageSection
				title="Marketplace"
				description="Browse open recruiting listings across the platform without leaving the app shell."
			>
				{marketplaceListings.length === 0 ? (
					<EmptyStateBlock
						title="No listings match this filter"
						description="Try another category or publish a listing of your own."
						variant="card"
					/>
				) : (
					<div className="space-y-4">
						{marketplaceListings.map((listing) => (
							<RecruitmentListingCard
								key={listing.id}
								listing={listing}
								currentUserId={user.id}
								entityOptions={entityOptions}
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
