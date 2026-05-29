import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";

export default function ModerationCaseNotFound() {
	return (
		<PageContainer>
			<EmptyStateBlock
				title="Case not found"
				description="This report doesn't exist or may have been removed."
				actionLabel="Back to queue"
				actionHref="/app/moderation"
				variant="page"
			/>
		</PageContainer>
	);
}
