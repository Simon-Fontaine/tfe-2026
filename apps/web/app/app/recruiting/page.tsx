import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { RecruitmentDiscoveryFilters } from "@/components/recruit/recruitment-discovery-filters";
import { RecruitmentListingCard } from "@/components/recruit/recruitment-listing-card";
import { RecruitmentListingFormDialog } from "@/components/recruit/recruitment-listing-form-dialog";
import { RecruitmentSentApplicationsPanel } from "@/components/recruit/recruitment-sent-applications-panel";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { getPlayerProfileFull } from "@/lib/data/player";
import {
	getManageableRecruitEntities,
	getMyRecruitmentApplications,
	getMyRecruitmentListings,
	getRecruitmentApplicationsForListing,
	getRecruitmentListings,
} from "@/lib/data/recruit";
import { RECRUITMENT_RANK_VALUES } from "@/lib/recruitment";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

const VALID_CATEGORIES = ["lft", "lfp", "lfr", "lfs"] as const;
const VALID_ROLES = ["tank", "damage", "support"] as const;

interface AppRecruitingPageProps {
	searchParams: Promise<{ category?: string; role?: string; rankFilter?: string; region?: string }>;
}

export default async function AppRecruitingPage({ searchParams }: AppRecruitingPageProps) {
	const { user } = await requireWorkspaceSession();

	const {
		category: categoryParam,
		role: roleParam,
		rankFilter: rankFilterParam,
		region: regionParam,
	} = await searchParams;

	const category = VALID_CATEGORIES.includes(categoryParam as (typeof VALID_CATEGORIES)[number])
		? (categoryParam as (typeof VALID_CATEGORIES)[number])
		: undefined;

	const role = (VALID_ROLES as readonly string[]).includes(roleParam ?? "")
		? (roleParam as "tank" | "damage" | "support")
		: undefined;

	const rankFilter = (RECRUITMENT_RANK_VALUES as readonly string[]).includes(rankFilterParam ?? "")
		? rankFilterParam
		: undefined;

	const region = regionParam?.trim() || undefined;

	const hasAnyFilters = !!(category || role || rankFilter || region);

	const [entityOptions, myListings, myApplications, profile, filteredListings] = await Promise.all([
		getManageableRecruitEntities(user.id),
		getMyRecruitmentListings(),
		getMyRecruitmentApplications(),
		getPlayerProfileFull(user.id).catch(() => null),
		getRecruitmentListings({ category, role, rankFilter, region }),
	]);

	const myListingIds = new Set(myListings.map((listing) => listing.id));
	const marketplaceListings = filteredListings.filter((listing) => !myListingIds.has(listing.id));

	const unfilteredSample =
		hasAnyFilters && marketplaceListings.length === 0 ? await getRecruitmentListings({}) : null;
	const unfilteredMarketplaceCount = unfilteredSample
		? unfilteredSample.filter((listing) => !myListingIds.has(listing.id)).length
		: null;

	const applicationsByListing = new Map(
		await Promise.all(
			myListings.map(
				async (listing) =>
					[listing.id, await getRecruitmentApplicationsForListing(listing.id)] as const
			)
		)
	);

	const currentFilters = {
		category: category ?? "all",
		role: role ?? "any",
		rankFilter: rankFilter ?? "any",
		region: region ?? "",
	};

	const emptyMarketplace = marketplaceListings.length === 0;
	const noMatchForFilters =
		emptyMarketplace && hasAnyFilters && (unfilteredMarketplaceCount ?? 0) > 0;

	return (
		<PageContainer>
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
				<RecruitmentDiscoveryFilters
					currentFilters={currentFilters}
					profileRank={profile?.rank ?? null}
					profileRole={profile?.primaryRole ?? null}
				/>
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
				{emptyMarketplace ? (
					noMatchForFilters ? (
						<EmptyStateBlock
							title="No listings match your filters"
							description="Try clearing some filters to see more results."
							variant="card"
						/>
					) : (
						<EmptyStateBlock
							title="No active listings yet"
							description="Be the first — publish a listing of your own."
							variant="card"
						/>
					)
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
