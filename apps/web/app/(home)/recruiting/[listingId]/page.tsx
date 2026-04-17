import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { RecruitmentApplicationDialog } from "@/components/recruit/recruitment-application-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getManageableRecruitEntities, getPublicRecruitmentListingById } from "@/lib/data/recruit";
import {
	formatRecruitmentAudience,
	formatRecruitmentCompRange,
	formatRecruitmentOwner,
	MEMBER_TYPE_LABELS,
	RECRUITMENT_CATEGORY_DESCRIPTIONS,
	RECRUITMENT_CATEGORY_LABELS,
} from "@/lib/recruitment";
import { publicRoutes } from "@/lib/routes";

export async function generateMetadata({ params }: { params: Promise<{ listingId: string }> }) {
	const { listingId } = await params;
	const listing = await getPublicRecruitmentListingById(listingId);

	if (!listing) {
		return { title: "Listing not found" };
	}

	return {
		title: listing.title,
		description: listing.description ?? RECRUITMENT_CATEGORY_DESCRIPTIONS[listing.category],
	};
}

export default async function PublicRecruitingListingDetailPage({
	params,
}: {
	params: Promise<{ listingId: string }>;
}) {
	const { listingId } = await params;
	const listingResult = await getPublicRecruitmentListingById(listingId);
	if (!listingResult) {
		notFound();
		return null;
	}
	const listing = listingResult;

	const { user } = await getCurrentSession();
	const entityOptions = user ? await getManageableRecruitEntities(user.id) : [];
	const ownerLabel = formatRecruitmentOwner(listing);
	const compRange = formatRecruitmentCompRange(listing);
	const ownerHref = listing.teamId
		? publicRoutes.teams.byId(listing.teamId)
		: listing.organizationSlug
			? publicRoutes.orgs.bySlug(listing.organizationSlug)
			: publicRoutes.players.byUsername(listing.ownerUsername);
	const isOpen = listing.status === "open";

	return (
		<PublicPageShell
			title={listing.title}
			description={RECRUITMENT_CATEGORY_DESCRIPTIONS[listing.category]}
			maxWidth="4xl"
			contentClassName="space-y-6"
			actions={
				isOpen ? (
					user ? (
						<RecruitmentApplicationDialog listing={listing} entityOptions={entityOptions}>
							<Button size="sm">Apply</Button>
						</RecruitmentApplicationDialog>
					) : (
						<Button asChild size="sm">
							<Link href="/auth?step=login">Sign in to apply</Link>
						</Button>
					)
				) : undefined
			}
		>
			{!isOpen && (
				<div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
					This listing is {listing.status} and is no longer accepting applications.
				</div>
			)}

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
					<Badge variant="secondary" className="text-[10px]">
						{RECRUITMENT_CATEGORY_LABELS[listing.category]}
					</Badge>
					<Badge variant="outline" className="text-[10px]">
						{MEMBER_TYPE_LABELS[listing.memberType]}
					</Badge>
					<Badge variant="outline" className="text-[10px] capitalize">
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
				</div>

				{listing.description ? (
					<p className="whitespace-pre-wrap text-sm text-muted-foreground">{listing.description}</p>
				) : (
					<p className="text-sm text-muted-foreground">
						No additional description was provided for this listing.
					</p>
				)}
			</div>
		</PublicPageShell>
	);
}
