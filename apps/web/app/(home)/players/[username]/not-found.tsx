import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { publicRoutes } from "@/lib/routes";

export default function PlayerNotFound() {
	return (
		<PublicPageShell title="Player" description="Public player profile." maxWidth="4xl">
			<EmptyStateBlock
				icon={UserSearch01Icon}
				title="Player not found"
				description="This player profile is not available. It may be private, archived, or the link may be incorrect."
				actionHref={publicRoutes.players.root}
				actionLabel="Back to players"
				variant="page"
			/>
		</PublicPageShell>
	);
}
