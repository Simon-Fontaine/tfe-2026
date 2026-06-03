import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import { appRoutes, publicRoutes } from "@scrimflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PublicFilterBar } from "@/components/home/public-filter-bar";
import { PublicListLoading } from "@/components/home/public-page-loading";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { RecruitmentListingCard } from "@/components/recruit/recruitment-listing-card";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getManageableRecruitEntities, getPublicRecruitmentListings } from "@/lib/data/recruit";
import { RECRUITMENT_CATEGORY_LABELS } from "@/lib/recruitment";

export const metadata: Metadata = {
	title: "Recruiting",
	description: "Browse Overwatch 2 recruiting listings for players, teams, and staff.",
};

const CATEGORY_FILTERS = ["all", "lft", "lfp", "lfr", "lfs"] as const;

interface PublicRecruitingPageProps {
	searchParams: Promise<{ category?: string; memberType?: string; region?: string }>;
}

export default async function PublicRecruitingPage({ searchParams }: PublicRecruitingPageProps) {
	const { user } = await getCurrentSession();
	const { category: categoryParam, memberType, region } = await searchParams;
	const category = CATEGORY_FILTERS.includes(
		(categoryParam ?? "all") as (typeof CATEGORY_FILTERS)[number]
	)
		? ((categoryParam ?? "all") as (typeof CATEGORY_FILTERS)[number])
		: "all";

	return (
		<PublicPageShell
			title="Recruiting"
			maxWidth="6xl"
			contentClassName="space-y-6"
			actions={
				<Button asChild size="sm">
					<Link href={user ? appRoutes.recruiting.root : publicRoutes.auth.step("login")}>
						{user ? "Open recruiting workspace" : "Sign in to apply"}
					</Link>
				</Button>
			}
		>
			<PublicFilterBar
				options={CATEGORY_FILTERS.map((filter) => ({
					label: filter === "all" ? "All listings" : RECRUITMENT_CATEGORY_LABELS[filter],
					href:
						filter === "all"
							? publicRoutes.recruiting.root
							: `${publicRoutes.recruiting.root}?category=${filter}`,
					active: category === filter,
				}))}
			/>

			<PublicFilterBar
				options={(
					[
						["all", "All member types"],
						["player", "Players"],
						["staff", "Staff"],
					] as const
				).map(([value, label]) => ({
					label,
					href:
						value === "all"
							? category === "all"
								? publicRoutes.recruiting.root
								: `${publicRoutes.recruiting.root}?category=${category}`
							: `${publicRoutes.recruiting.root}?${new URLSearchParams({
									...(category !== "all" ? { category } : {}),
									memberType: value,
								}).toString()}`,
					active: (memberType ?? "all") === value,
				}))}
			/>

			<Suspense fallback={<PublicListLoading />}>
				<RecruitingListSection
					category={category}
					memberType={memberType}
					region={region}
					userId={user?.id ?? null}
				/>
			</Suspense>
		</PublicPageShell>
	);
}

async function RecruitingListSection({
	category,
	memberType,
	region,
	userId,
}: {
	category: (typeof CATEGORY_FILTERS)[number];
	memberType?: string;
	region?: string;
	userId: string | null;
}) {
	const entityOptions = userId ? await getManageableRecruitEntities(userId).catch(() => []) : [];

	let listings: Awaited<ReturnType<typeof getPublicRecruitmentListings>> = [];
	let hasError = false;
	try {
		listings = await getPublicRecruitmentListings({
			category: category === "all" ? undefined : category,
			memberType:
				memberType === "player" || memberType === "staff"
					? (memberType as "player" | "staff")
					: undefined,
			region: region || undefined,
		});
	} catch {
		hasError = true;
	}

	if (hasError) {
		return (
			<EmptyStateBlock
				icon={UserSearch01Icon}
				title="Could not load content"
				description="Something went wrong loading this page. Please refresh to try again."
				variant="page"
			/>
		);
	}

	if (listings.length === 0) {
		return (
			<EmptyStateBlock
				icon={UserSearch01Icon}
				title="No open listings"
				description="Check back later — new recruiting listings are added regularly."
				variant="page"
			/>
		);
	}

	return (
		<div className="divide-y border">
			{listings.map((listing) => (
				<RecruitmentListingCard
					key={listing.id}
					listing={listing}
					currentUserId={userId}
					entityOptions={entityOptions}
					detailHref={publicRoutes.recruiting.byId(listing.id)}
					className="border-0 px-4 py-3"
				/>
			))}
		</div>
	);
}
