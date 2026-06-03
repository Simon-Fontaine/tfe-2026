import { UserGroupIcon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	title: "Organizations",
	description: "Discover Overwatch 2 esports organizations on Scrimflow.",
};

import { publicRoutes } from "@scrimflow/shared";
import { Suspense } from "react";
import { OrgsDirectoryList } from "@/components/home/orgs-directory-list";
import { PublicFilterBar } from "@/components/home/public-filter-bar";
import { PublicListLoading } from "@/components/home/public-page-loading";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { getPublicOrgs } from "@/lib/data/organization";

type OrgSort = "teams" | "roster" | "name";

interface OrgsDirectoryPageProps {
	searchParams: Promise<{ sort?: string }>;
}

export default async function OrgsDirectoryPage({ searchParams }: OrgsDirectoryPageProps) {
	const { sort: sortParam } = await searchParams;
	const sort = (["teams", "roster", "name"] as const).includes((sortParam ?? "teams") as OrgSort)
		? ((sortParam ?? "teams") as OrgSort)
		: "teams";

	return (
		<PublicPageShell
			title="Organizations"
			maxWidth="6xl"
			contentClassName="space-y-6"
			actions={
				<Button asChild size="sm" variant="outline">
					<Link href={publicRoutes.updates.root}>See public updates</Link>
				</Button>
			}
		>
			<PublicFilterBar
				options={(
					[
						["teams", "Most teams"],
						["roster", "Largest rosters"],
						["name", "A to Z"],
					] as const
				).map(([value, label]) => ({
					label,
					href: publicRoutes.orgs.withSort(value),
					active: sort === value,
				}))}
			/>
			<Suspense fallback={<PublicListLoading itemCount={6} itemHeightClassName="h-16" />}>
				<OrgListSection sort={sort} />
			</Suspense>
		</PublicPageShell>
	);
}

async function OrgListSection({ sort }: { sort: OrgSort }) {
	let orgs: Awaited<ReturnType<typeof getPublicOrgs>> = [];
	let hasError = false;
	try {
		orgs = await getPublicOrgs();
	} catch {
		hasError = true;
	}

	if (hasError) {
		return (
			<EmptyStateBlock
				icon={UserGroupIcon}
				title="Could not load content"
				description="Something went wrong loading this page. Please refresh to try again."
				variant="page"
			/>
		);
	}

	if (orgs.length === 0) {
		return (
			<EmptyStateBlock
				icon={UserGroupIcon}
				title="No public organizations yet"
				description="Check back later as organizations publish their workspace profiles."
				variant="page"
			/>
		);
	}

	const sortedOrgs = [...orgs].sort((a, b) => {
		if (sort === "name") return a.name.localeCompare(b.name);
		if (sort === "roster") return b.activeRosterCount - a.activeRosterCount;
		return b.teamCount - a.teamCount;
	});

	return <OrgsDirectoryList orgs={sortedOrgs} />;
}
