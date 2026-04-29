import { GameController01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	title: "Organizations",
	description: "Discover Overwatch 2 esports organizations on Scrimflow.",
};

import { HugeiconsIcon } from "@hugeicons/react";
import { Suspense } from "react";
import { PublicGridLoading } from "@/components/home/public-page-loading";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPublicOrgs } from "@/lib/data/organization";
import { publicRoutes } from "@/lib/routes";

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
			description="Discover organizations and the teams they operate."
			maxWidth="6xl"
			contentClassName="space-y-6"
			actions={
				<Button asChild size="sm" variant="outline">
					<Link href="/updates">See public updates</Link>
				</Button>
			}
		>
			<div className="flex flex-wrap gap-2">
				{(
					[
						["teams", "Most teams"],
						["roster", "Largest rosters"],
						["name", "A to Z"],
					] as const
				).map(([value, label]) => (
					<Link key={value} href={value === "teams" ? "/orgs" : `/orgs?sort=${value}`}>
						<Badge variant={sort === value ? "default" : "outline"}>{label}</Badge>
					</Link>
				))}
			</div>
			<Suspense fallback={<PublicGridLoading />}>
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

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{sortedOrgs.map((org) => (
				<Link
					key={org.id}
					href={publicRoutes.orgs.bySlug(org.slug)}
					className="flex items-center gap-3 border p-4 transition-colors hover:bg-muted/50"
				>
					<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={org.avatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-xs font-bold">
							{org.name.substring(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-semibold">{org.name}</p>
						<div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
							<span className="flex items-center gap-1">
								<HugeiconsIcon icon={GameController01Icon} strokeWidth={2} className="size-3" />
								{org.teamCount} team{org.teamCount === 1 ? "" : "s"}
							</span>
							<span className="flex items-center gap-1">
								<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-3" />
								{org.activeRosterCount} active
							</span>
						</div>
					</div>
				</Link>
			))}
		</div>
	);
}
