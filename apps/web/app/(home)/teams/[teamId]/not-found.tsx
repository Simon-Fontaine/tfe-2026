import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { publicRoutes } from "@/lib/routes";

export default function TeamNotFound() {
	return (
		<PublicPageShell title="Team" description="Public team profile." maxWidth="4xl">
			<EmptyStateBlock
				icon={UserGroupIcon}
				title="Team not found"
				description="This team profile is not available. It may be private, archived, or the link may be incorrect."
				actionHref={publicRoutes.teams.root}
				actionLabel="Browse teams"
				variant="page"
			/>
		</PublicPageShell>
	);
}
