import { Notification01Icon } from "@hugeicons/core-free-icons";
import { publicRoutes } from "@scrimflow/shared";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";

export default function UpdateNotFound() {
	return (
		<PublicPageShell title="Update" description="Public update post." maxWidth="3xl">
			<EmptyStateBlock
				icon={Notification01Icon}
				title="Update not found"
				description="This update is not available. It may be workspace-only, the link may be incorrect, or it has been removed."
				actionHref={publicRoutes.updates.root}
				actionLabel="Back to updates"
				variant="page"
			/>
		</PublicPageShell>
	);
}
