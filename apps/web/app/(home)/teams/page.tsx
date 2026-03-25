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
		<section className="border-b px-4 py-14 md:py-20" aria-labelledby="teams-heading">
			<div className="mx-auto max-w-6xl space-y-6">
				<div>
					<h1 id="teams-heading" className="text-lg font-bold leading-tight md:text-2xl">
						Teams
					</h1>
					<p className="mt-3 max-w-[48ch] text-xs text-muted-foreground leading-relaxed">
						Explore team profiles, roster size, and recruiting status.
					</p>
				</div>

				<TeamDiscoveryFilters recruitingFilter={recruitingFilter} />

				{teams.length === 0 ? (
					<div className="flex flex-col items-center justify-center border border-dashed p-6 py-16 text-center">
						<p className="text-sm font-bold">No teams matched this filter</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Try changing filters or check back as new teams are published.
						</p>
					</div>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{teams.map((team) => (
							<TeamDiscoveryCard key={team.id} team={team} />
						))}
					</div>
				)}
			</div>
		</section>
	);
}
