import Link from "next/link";
import { notFound } from "next/navigation";
import { RecruitmentApplicationDialog } from "@/components/recruit/recruitment-application-dialog";
import { RecruitmentApplicationsPanel } from "@/components/recruit/recruitment-applications-panel";
import { RecruitmentListingFormDialog } from "@/components/recruit/recruitment-listing-form-dialog";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import {
	getManageableRecruitEntities,
	getRecruitmentApplicationsForListing,
	getRecruitmentListingRouteState,
} from "@/lib/data/recruit";
import {
	formatRecruitmentAudience,
	formatRecruitmentCompRange,
	formatRecruitmentOwner,
	MEMBER_TYPE_LABELS,
	RECRUITMENT_CATEGORY_DESCRIPTIONS,
	RECRUITMENT_CATEGORY_LABELS,
} from "@/lib/recruitment";
import { publicRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppRecruitingListingDetailPage({
	params,
}: {
	params: Promise<{ listingId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { listingId } = await params;
	const listingResult = await getRecruitmentListingRouteState(listingId);
	if (listingResult.kind === "missing") {
		notFound();
	}
	if (listingResult.kind === "no-access") {
		return (
			<PageContainer maxWidth="4xl">
				<PageHeader
					title="Recruiting"
					detail="Listing detail"
					description="Review recruiting details from the current workspace without leaving the app shell."
				/>
				<EmptyStateBlock
					title="No access"
					description="You can only open listing details that belong to a workspace you can manage or apply from."
					variant="card"
				/>
			</PageContainer>
		);
	}
	const listing = listingResult.data;

	const [entityOptions, applications] = await Promise.all([
		getManageableRecruitEntities(user.id),
		listing.canManage ? getRecruitmentApplicationsForListing(listingId) : Promise.resolve([]),
	]);

	const ownerLabel = formatRecruitmentOwner(listing);
	const compRange = formatRecruitmentCompRange(listing);
	const ownerHref = listing.teamId
		? publicRoutes.teams.byId(listing.teamId)
		: listing.organizationSlug
			? publicRoutes.orgs.bySlug(listing.organizationSlug)
			: publicRoutes.players.byUsername(listing.ownerUsername);
	const canApply = listing.canApply && !listing.canManage && listing.status === "open";

	return (
		<PageContainer maxWidth="4xl">
			<PageHeader
				title={listing.title}
				detail={`Listing ${listing.id}`}
				description={RECRUITMENT_CATEGORY_DESCRIPTIONS[listing.category]}
				actions={
					listing.canManage ? (
						<RecruitmentListingFormDialog
							mode="edit"
							listing={listing}
							ownerOptions={entityOptions}
							triggerContent="Edit listing"
							triggerVariant="outline"
						/>
					) : canApply ? (
						<RecruitmentApplicationDialog listing={listing} entityOptions={entityOptions}>
							<Button size="sm">Apply</Button>
						</RecruitmentApplicationDialog>
					) : undefined
				}
			>
				<div className="flex flex-wrap gap-2">
					<Badge variant="secondary" className="text-[10px]">
						{RECRUITMENT_CATEGORY_LABELS[listing.category]}
					</Badge>
					<Badge variant="outline" className="text-[10px]">
						{MEMBER_TYPE_LABELS[listing.memberType]}
					</Badge>
					<Badge variant="outline" className="text-[10px] capitalize">
						{listing.status}
					</Badge>
				</div>
			</PageHeader>

			{listing.status !== "open" && (
				<div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
					This listing is {listing.status} and is no longer accepting applications.
				</div>
			)}

			<PageSection title="About" description="Full listing details and ownership context.">
				<div className="space-y-4 border p-4">
					<div className="flex items-center gap-3">
						<Link href={ownerHref}>
							<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
								<AvatarImage
									src={
										listing.teamAvatarUrl ??
										listing.organizationAvatarUrl ??
										listing.ownerAvatarUrl ??
										undefined
									}
									className="rounded-none"
								/>
								<AvatarFallback className="rounded-none text-[10px] font-bold">
									{ownerLabel.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
						</Link>
						<div>
							<Link href={ownerHref} className="text-sm font-semibold hover:underline">
								{ownerLabel}
							</Link>
							<p className="text-xs text-muted-foreground">
								{RECRUITMENT_CATEGORY_DESCRIPTIONS[listing.category]}
							</p>
						</div>
					</div>

					<div className="flex flex-wrap gap-2">
						<Badge variant="outline" className="text-[10px]">
							{formatRecruitmentAudience(listing)}
						</Badge>
						{compRange && (
							<Badge variant="outline" className="text-[10px]">
								{compRange}
							</Badge>
						)}
						{listing.region && (
							<Badge variant="outline" className="text-[10px]">
								{listing.region}
							</Badge>
						)}
						<Badge variant="secondary" className="text-[10px]">
							{listing.applicationCount} application{listing.applicationCount === 1 ? "" : "s"}
						</Badge>
					</div>

					{listing.description ? (
						<p className="whitespace-pre-wrap text-sm text-muted-foreground">
							{listing.description}
						</p>
					) : (
						<p className="text-sm text-muted-foreground">
							No additional description was provided for this listing.
						</p>
					)}
				</div>
			</PageSection>

			{listing.canManage && (
				<PageSection
					title="Applications"
					description="Review and respond to incoming applications for this listing."
				>
					<RecruitmentApplicationsPanel
						applications={applications}
						teamId={listing.teamId ?? undefined}
						organizationId={listing.organizationId ?? undefined}
					/>
				</PageSection>
			)}
		</PageContainer>
	);
}
