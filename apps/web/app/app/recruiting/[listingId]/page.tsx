import { Blockchain01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecruitmentApplicationDialog } from "@/components/recruit/recruitment-application-dialog";
import { RecruitmentApplicationsPanel } from "@/components/recruit/recruitment-applications-panel";
import { RecruitmentListingFormDialog } from "@/components/recruit/recruitment-listing-form-dialog";
import { ReportListingActions } from "@/components/reports/report-listing-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import {
	getManageableRecruitEntities,
	getRecruitmentApplicationsForListing,
	getRecruitmentListingRouteState,
} from "@/lib/data/recruit";
import {
	formatRecruitmentAudience,
	formatRecruitmentCompRange,
	formatRecruitmentOwner,
	getRecruitmentApplicationLabel,
	MEMBER_TYPE_LABELS,
	RECRUITMENT_CATEGORY_DESCRIPTIONS,
	RECRUITMENT_CATEGORY_LABELS,
} from "@/lib/recruitment";
import { appRoutes, publicRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
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
			<PageContainer>
				<PageHeader
					title="Recruiting"
					breadcrumbs={
						<Link href={appRoutes.recruiting.root} className="hover:underline">
							Recruiting
						</Link>
					}
				/>
				<EmptyState icon={Blockchain01Icon} title="You do not have access to this listing." />
			</PageContainer>
		);
	}
	if (listingResult.kind !== "success") {
		notFound();
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
	const isTerminal =
		listing.status === "closed" || listing.status === "fulfilled" || listing.status === "expired";

	return (
		<PageContainer>
			<PageHeader
				title={listing.title}
				breadcrumbs={
					<Link href={appRoutes.recruiting.root} className="hover:underline">
						Recruiting
					</Link>
				}
			/>

			<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
				{/* Main content — left 2/3 */}
				<div className="col-span-1 space-y-8 md:col-span-2">
					{listing.status !== "open" && (
						<div className="border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
							{listing.status === "paused"
								? "This listing is paused and not currently accepting applications."
								: `This listing is ${listing.status} and is no longer accepting applications.`}
						</div>
					)}

					<section>
						<h2 className="mb-4 border-b pb-2 text-lg font-semibold">About</h2>
						<div className="space-y-4">
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

							{listing.description ? (
								<p className="whitespace-pre-wrap text-sm text-muted-foreground">
									{listing.description}
								</p>
							) : (
								<p className="text-sm text-muted-foreground">No additional description provided.</p>
							)}
						</div>
					</section>

					{listing.canManage && (
						<section>
							<h2 className="mb-4 border-b pb-2 text-lg font-semibold">Applications</h2>
							<RecruitmentApplicationsPanel
								applications={applications}
								teamId={listing.teamId ?? undefined}
								organizationId={listing.organizationId ?? undefined}
							/>
						</section>
					)}
				</div>

				{/* Right metadata column — 1/3 */}
				<div className="space-y-6">
					<div className="space-y-3">
						<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Details
						</h3>
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline" className="text-[10px]">
								{RECRUITMENT_CATEGORY_LABELS[listing.category]}
							</Badge>
							<Badge variant="outline" className="text-[10px]">
								{MEMBER_TYPE_LABELS[listing.memberType]}
							</Badge>
							<Badge
								variant="outline"
								className={cn(
									"text-[10px]",
									listing.status === "open"
										? STATUS_BADGE_CLASSES.open
										: listing.status === "paused"
											? STATUS_BADGE_CLASSES.paused
											: ""
								)}
							>
								{listing.status}
							</Badge>
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
							<Badge variant="outline" className="text-[10px]">
								{listing.applicationCount} application
								{listing.applicationCount === 1 ? "" : "s"}
							</Badge>
						</div>
					</div>

					<div className="space-y-2">
						{canApply && (
							<RecruitmentApplicationDialog
								listing={listing}
								entityOptions={entityOptions}
								conversationHrefBase={appRoutes.recruiting.conversations}
							>
								<Button size="sm" className="w-full">
									{getRecruitmentApplicationLabel(listing)}
								</Button>
							</RecruitmentApplicationDialog>
						)}
						{listing.canManage && !isTerminal && (
							<RecruitmentListingFormDialog
								mode="edit"
								listing={listing}
								ownerOptions={entityOptions}
								triggerContent="Edit listing"
								triggerVariant="outline"
							/>
						)}
						{!listing.canManage && (
							<ReportListingActions listingId={listing.id} listingTitle={listing.title} />
						)}
					</div>
				</div>
			</div>
		</PageContainer>
	);
}
