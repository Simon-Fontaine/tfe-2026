import { Add01Icon, Search01Icon, SearchList02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecruitmentApplicationDialog } from "@/components/recruit/recruitment-application-dialog";
import { RecruitmentDiscoveryFilters } from "@/components/recruit/recruitment-discovery-filters";
import { RecruitmentListingCard } from "@/components/recruit/recruitment-listing-card";
import { RecruitmentListingFormDialog } from "@/components/recruit/recruitment-listing-form-dialog";
import { RecruitmentSentApplicationsPanel } from "@/components/recruit/recruitment-sent-applications-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageSection } from "@/components/workspace/page-section";
import { getPlayerProfileFull } from "@/lib/data/player";
import {
	getManageableRecruitEntities,
	getMyRecruitmentApplications,
	getMyRecruitmentListings,
	getRecruitmentApplicationsForListing,
	getRecruitmentListings,
} from "@/lib/data/recruit";
import {
	formatRecruitmentOwner,
	RECRUITMENT_CATEGORY_LABELS,
	RECRUITMENT_RANK_VALUES,
} from "@/lib/recruitment";
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

	const canApplyToListing = (listing: (typeof marketplaceListings)[number]) =>
		listing.canApply && !listing.canManage && listing.status === "open";

	return (
		<PageContainer>
			<PageHeader
				title="Recruiting"
				action={
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
			/>

			<RecruitmentDiscoveryFilters
				currentFilters={currentFilters}
				profileRank={profile?.rank ?? null}
				profileRole={profile?.primaryRole ?? null}
			/>

			<PageSection title="Your listings">
				{myListings.length === 0 ? (
					<EmptyState icon={Add01Icon} title="No recruiting listings yet." />
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

			<PageSection title="Sent applications">
				<RecruitmentSentApplicationsPanel
					applications={myApplications}
					conversationHrefBase={appRoutes.recruiting.conversations}
				/>
			</PageSection>

			<PageSection title="Marketplace">
				{emptyMarketplace ? (
					noMatchForFilters ? (
						<EmptyState icon={SearchList02Icon} title="No listings match your filters." />
					) : (
						<EmptyState icon={Search01Icon} title="No active listings yet." />
					)
				) : (
					<div>
						{marketplaceListings.map((listing) => (
							<div
								key={listing.id}
								className="flex items-center justify-between border-b py-3 text-sm"
							>
								<div className="min-w-0 flex-1 space-y-0.5">
									<Link
										href={appRoutes.recruiting.byId(listing.id)}
										className="font-medium hover:underline"
									>
										{listing.title}
									</Link>
									<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
										<span>{formatRecruitmentOwner(listing)}</span>
										<Badge variant="outline" className="text-[10px]">
											{RECRUITMENT_CATEGORY_LABELS[listing.category]}
										</Badge>
										<Badge variant="outline" className="text-[10px]">
											{listing.applicationCount} application
											{listing.applicationCount === 1 ? "" : "s"}
										</Badge>
										{listing.hasApplied && (
											<Badge
												variant="outline"
												className="text-[10px] border-green-600 text-green-700"
											>
												Applied
											</Badge>
										)}
									</div>
								</div>
								<div className="ml-4 shrink-0">
									{canApplyToListing(listing) && (
										<RecruitmentApplicationDialog
											listing={listing}
											entityOptions={entityOptions}
											conversationHrefBase={appRoutes.recruiting.conversations}
										>
											<Button size="sm" variant="outline">
												Apply
											</Button>
										</RecruitmentApplicationDialog>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</PageSection>
		</PageContainer>
	);
}
