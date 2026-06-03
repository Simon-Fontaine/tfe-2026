import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import { appRoutes, publicRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { PublicRelatedRouteCards } from "@/components/home/public-related-route-cards";
import { RecruitmentApplicationDialog } from "@/components/recruit/recruitment-application-dialog";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
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

export async function generateMetadata({ params }: { params: Promise<{ listingId: string }> }) {
	const { listingId } = await params;
	let listing: Awaited<ReturnType<typeof getPublicRecruitmentListingById>> | null = null;
	try {
		listing = await getPublicRecruitmentListingById(listingId);
	} catch {
		// metadata fetch failed — return fallback
	}

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

	let listing: Awaited<ReturnType<typeof getPublicRecruitmentListingById>>;
	try {
		const result = await getPublicRecruitmentListingById(listingId);
		if (!result) {
			notFound();
		}
		listing = result;
	} catch {
		return (
			<PublicPageShell title="Listing" maxWidth="4xl" contentClassName="space-y-6">
				<EmptyStateBlock
					icon={UserSearch01Icon}
					title="Could not load this page"
					description="The listing could not be loaded right now. Browse open recruiting listings or try again in a moment."
					actionHref={publicRoutes.recruiting.root}
					actionLabel="Browse listings"
					variant="page"
				/>
			</PublicPageShell>
		);
	}

	const { user } = await getCurrentSession();
	const entityOptions = user ? await getManageableRecruitEntities(user.id).catch(() => []) : [];
	const ownerLabel = formatRecruitmentOwner(listing);
	const compRange = formatRecruitmentCompRange(listing);
	const ownerHref = listing.teamId
		? publicRoutes.teams.byId(listing.teamId)
		: listing.organizationSlug
			? publicRoutes.orgs.bySlug(listing.organizationSlug)
			: publicRoutes.players.byUsername(listing.ownerUsername);
	const isOpen = listing.status === "open";

	return (
		<PublicPageShell title={listing.title} maxWidth="4xl" contentClassName="space-y-6">
			{!isOpen && (
				<div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
					This listing is {listing.status} and is no longer accepting applications.
				</div>
			)}

			<div className="grid gap-6 sm:grid-cols-3">
				<div className="col-span-2 space-y-4">
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
						<p className="text-sm text-muted-foreground">
							No additional description was provided for this listing.
						</p>
					)}
				</div>

				<div className="space-y-4">
					<div className="flex flex-wrap gap-2">
						<Badge variant="outline" className="text-[10px]">
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

					{isOpen ? (
						user ? (
							<RecruitmentApplicationDialog listing={listing} entityOptions={entityOptions}>
								<Button size="sm">Apply</Button>
							</RecruitmentApplicationDialog>
						) : (
							<Button asChild size="sm">
								<Link
									href={`${publicRoutes.auth.step("login")}?next=${encodeURIComponent(`/recruiting/${listingId}`)}`}
								>
									Sign in to apply
								</Link>
							</Button>
						)
					) : (
						<p className="text-xs text-muted-foreground">
							This listing is {listing.status} and is no longer accepting applications.
						</p>
					)}
				</div>
			</div>

			<PublicPageSection title="Related public routes">
				<PublicRelatedRouteCards
					cards={[
						{
							label: "Open source profile",
							href: ownerHref,
						},
						{
							label: "More listings",
							href: publicRoutes.recruiting.root,
						},
						{
							label: user ? "Open recruiting workspace" : "Sign in to continue",
							href: user ? appRoutes.recruiting.root : publicRoutes.auth.step("login"),
						},
					]}
				/>
			</PublicPageSection>
		</PublicPageShell>
	);
}
