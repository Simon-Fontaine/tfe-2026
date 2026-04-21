import { GameController01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Teams",
	description: "Browse Overwatch 2 teams and find your next roster.",
};

import { Suspense } from "react";
import { PublicGridLoading } from "@/components/home/public-page-loading";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { TeamDiscoveryCard } from "@/components/teams/discovery/team-discovery-card";
import { TeamDiscoveryFilters } from "@/components/teams/discovery/team-discovery-filters";
import { getTeamsForDiscovery } from "@/lib/data/discovery";

interface TeamsDirectoryPageProps {
	searchParams: Promise<{ recruiting?: string }>;
}

export default async function TeamsDirectoryPage({ searchParams }: TeamsDirectoryPageProps) {
	const { recruiting } = await searchParams;
	const recruitingFilter =
		recruiting === "true" ? true : recruiting === "false" ? false : undefined;

	return (
		<PublicPageShell
			title="Teams"
			description="Explore team profiles, roster size, and recruiting status."
			maxWidth="6xl"
			contentClassName="space-y-6"
		>
			<TeamDiscoveryFilters recruitingFilter={recruitingFilter} />

			<Suspense fallback={<PublicGridLoading />}>
				<TeamListSection recruitingFilter={recruitingFilter} />
			</Suspense>
		</PublicPageShell>
	);
}

async function TeamListSection({ recruitingFilter }: { recruitingFilter: boolean | undefined }) {
	let teams: Awaited<ReturnType<typeof getTeamsForDiscovery>> = [];
	let hasError = false;
	try {
		teams = await getTeamsForDiscovery({ recruiting: recruitingFilter });
	} catch {
		hasError = true;
	}

	if (hasError) {
		return (
			<EmptyStateBlock
				icon={GameController01Icon}
				title="Could not load content"
				description="Something went wrong loading this page. Please refresh to try again."
				variant="page"
			/>
		);
	}

	if (teams.length === 0) {
		return (
			<EmptyStateBlock
				icon={GameController01Icon}
				title="No public teams yet"
				description="Check back later as teams publish their profiles."
				variant="page"
			/>
		);
	}

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{teams.map((team) => (
				<TeamDiscoveryCard key={team.id} team={team} />
			))}
		</div>
	);
}
