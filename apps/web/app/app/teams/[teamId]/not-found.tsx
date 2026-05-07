import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";

export default function TeamNotFound() {
	return (
		<PageContainer>
			<EmptyStateBlock
				title="Team not found"
				description="This team doesn't exist or you don't have access."
				actionLabel="Back to home"
				actionHref="/app"
				variant="page"
			/>
		</PageContainer>
	);
}
