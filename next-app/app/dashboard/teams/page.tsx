import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SettingsHeaderBar } from "@/components/settings/settings-header-bar";
import { TeamDiscoveryCard } from "@/components/teams/discovery/team-discovery-card";
import { TeamDiscoveryFilters } from "@/components/teams/discovery/team-discovery-filters";
import { getTeamsForDiscovery } from "@/lib/data/discovery";

export default async function TeamDiscoveryPage({
	searchParams,
}: {
	searchParams: Promise<{ recruiting?: string }>;
}) {
	const { recruiting } = await searchParams;
	const recruitingFilter =
		recruiting === "true" ? true : recruiting === "false" ? false : undefined;

	const teams = await getTeamsForDiscovery({ recruiting: recruitingFilter });

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<SettingsHeaderBar
				backHref="/dashboard"
				icon={Search01Icon}
				title="Find Teams"
				subtitle="Browse teams and find one to join"
			/>

			<TeamDiscoveryFilters recruitingFilter={recruitingFilter} />

			{teams.length === 0 ? (
				<div className="flex flex-col items-center justify-center border border-dashed px-6 py-16 text-center">
					<HugeiconsIcon
						icon={Search01Icon}
						strokeWidth={1.5}
						className="mb-4 size-10 text-muted-foreground/40"
					/>
					<p className="text-sm font-medium">No teams found</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Try adjusting your filters or check back later.
					</p>
				</div>
			) : (
				<div className="grid gap-3 sm:grid-cols-2">
					{teams.map((team) => (
						<TeamDiscoveryCard key={team.id} team={team} />
					))}
				</div>
			)}
		</div>
	);
}
