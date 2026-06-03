import { publicRoutes } from "@scrimflow/shared";
import { PublicFilterBar } from "@/components/home/public-filter-bar";

interface TeamDiscoveryFiltersProps {
	recruitingFilter: boolean | undefined;
}

export function TeamDiscoveryFilters({ recruitingFilter }: TeamDiscoveryFiltersProps) {
	return (
		<PublicFilterBar
			options={[
				{
					label: "All teams",
					href: publicRoutes.teams.root,
					active: recruitingFilter === undefined,
				},
				{
					label: "Recruiting only",
					href: `${publicRoutes.teams.root}?recruiting=true`,
					active: recruitingFilter === true,
				},
			]}
		/>
	);
}
