import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "./page-container";
import { PageHeader } from "./page-header";

interface AccessGateProps {
	/** Page title shown in the header (e.g. "Roster", "Overview") */
	title: string;
	/** Resource type used to generate friendly detail label and default description */
	resourceType: "team" | "organization" | "scrim";
	/** Override the default description */
	description?: string;
	/** Back navigation href for the EmptyStateBlock action */
	backHref?: string;
	/** Back navigation label */
	backLabel?: string;
}

export function AccessGate({
	title,
	resourceType,
	description,
	backHref = "/app",
	backLabel = "Go back",
}: AccessGateProps) {
	const detail = `${resourceType} workspace`;
	const fallbackDescription = `This ${resourceType} isn't available or you don't have access.`;

	return (
		<PageContainer>
			<PageHeader title={title} detail={detail} />
			<EmptyStateBlock
				title="Access unavailable"
				description={description ?? fallbackDescription}
				actionLabel={backLabel}
				actionHref={backHref}
				variant="card"
			/>
		</PageContainer>
	);
}
