import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";

export default function ScrimNotFound() {
	return (
		<PageContainer>
			<EmptyStateBlock
				title="Scrim not found"
				description="This scrim doesn't exist or you don't have access."
				actionLabel="Back to home"
				actionHref="/app"
				variant="page"
			/>
		</PageContainer>
	);
}
