import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";

export default function ListingNotFound() {
	return (
		<PageContainer>
			<EmptyStateBlock
				title="Listing not found"
				description="This recruiting listing doesn't exist or has been removed."
				actionLabel="Browse listings"
				actionHref="/app/recruiting"
				variant="page"
			/>
		</PageContainer>
	);
}
