import { GameController01Icon } from "@hugeicons/core-free-icons";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { publicRoutes } from "@/lib/routes";

export default function OrgNotFound() {
	return (
		<PublicPageShell title="Organization" description="Public organization profile." maxWidth="5xl">
			<EmptyStateBlock
				icon={GameController01Icon}
				title="Organization not found"
				description="This organization profile is not available. It may be private, archived, or the link may be incorrect."
				actionHref={publicRoutes.orgs.root}
				actionLabel="Browse organizations"
				variant="page"
			/>
		</PublicPageShell>
	);
}
