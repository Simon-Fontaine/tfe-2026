import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/workspace/page-container";

export default function RecruitingConversationsLoading() {
	return (
		<PageContainer>
			{/* Breadcrumb + header skeleton */}
			<div className="space-y-1">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-8 w-48" />
			</div>
			{/* Two-panel skeleton */}
			<div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
				{/* Sidebar */}
				<div className="border">
					{Array.from({ length: 5 }, (_, i) => `conv-${i}`).map((key) => (
						<div key={key} className="space-y-1 border-b px-3 py-3">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-3 w-32" />
						</div>
					))}
				</div>
				{/* Main pane */}
				<div className="min-h-[520px] border" />
			</div>
		</PageContainer>
	);
}
