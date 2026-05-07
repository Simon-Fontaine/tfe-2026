import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";

export default function OrgNotFound() {
	return (
		<PageContainer>
			<EmptyStateBlock
				title="Organization not found"
				description="This organization doesn't exist or you don't have access."
				actionLabel="Back to home"
				actionHref="/app"
				variant="page"
			/>
		</PageContainer>
	);
}
