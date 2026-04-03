import { GameController01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Teams",
	description: "Browse Overwatch 2 teams and find your next roster.",
};

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
	const teams = await getTeamsForDiscovery({ recruiting: recruitingFilter });

	return (
		<PublicPageShell
			title="Teams"
			description="Explore team profiles, roster size, and recruiting status."
			maxWidth="6xl"
			contentClassName="space-y-6"
		>
			<TeamDiscoveryFilters recruitingFilter={recruitingFilter} />

			{teams.length === 0 ? (
				<EmptyStateBlock
					icon={GameController01Icon}
					title="No teams matched this filter"
					description="Try changing filters or check back as new teams are published."
					variant="page"
				/>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{teams.map((team) => (
						<TeamDiscoveryCard key={team.id} team={team} />
					))}
				</div>
			)}
		</PublicPageShell>
	);
}
