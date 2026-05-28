import type { PermissionDenialReason } from "@scrimflow/shared";
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
	/** Permission denial reason for contextual recovery guidance */
	reason?: PermissionDenialReason;
	/** Back navigation href for the EmptyStateBlock action */
	backHref?: string;
	/** Back navigation label */
	backLabel?: string;
}

function getRecoveryGuidance(
	reason: PermissionDenialReason | undefined,
	resourceType: string
): { description: string; actionLabel: string; actionHref: string } {
	switch (reason) {
		case "role":
			return {
				description: `You don't have the required role for this ${resourceType} workspace. Contact a team or organization admin if you need access.`,
				actionLabel: "Go back",
				actionHref: "/app",
			};
		case "lifecycle":
			return {
				description: `This ${resourceType} is archived or inactive and is no longer accessible.`,
				actionLabel: "Go back",
				actionHref: "/app",
			};
		case "ownership":
			return {
				description: "Only the owner can access this area.",
				actionLabel: "Go back",
				actionHref: "/app",
			};
		case "verification":
			return {
				description: "Identity verification is required to access this area.",
				actionLabel: "Go to security settings",
				actionHref: "/app/settings/security",
			};
		case "privacy":
			return {
				description: `This ${resourceType} is private and not available to you.`,
				actionLabel: "Go back",
				actionHref: "/app",
			};
		case "settlement-lock":
			return {
				description: `This action is locked while ${resourceType} results are being finalized.`,
				actionLabel: "Go back",
				actionHref: "/app",
			};
		case "moderation":
			return {
				description:
					"Access to this area has been restricted. Contact support if you believe this is an error.",
				actionLabel: "Go back",
				actionHref: "/app",
			};
		default:
			return {
				description: `This ${resourceType} isn't available or you don't have access.`,
				actionLabel: "Go back",
				actionHref: "/app",
			};
	}
}

export function AccessGate({
	title,
	resourceType,
	description,
	reason,
	backHref,
	backLabel,
}: AccessGateProps) {
	const guidance = getRecoveryGuidance(reason, resourceType);
	const finalDescription = description ?? guidance.description;
	const finalActionLabel = backLabel ?? guidance.actionLabel;
	const finalActionHref = backHref ?? guidance.actionHref;

	return (
		<PageContainer>
			<PageHeader title={title} detail={`${resourceType} workspace`} />
			<EmptyStateBlock
				title="Access unavailable"
				description={finalDescription}
				actionLabel={finalActionLabel}
				actionHref={finalActionHref}
				variant="card"
			/>
		</PageContainer>
	);
}
