import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/workspace/page-container";

export default function CalendarLoading() {
	return (
		<PageContainer>
			{/* PageHeader skeleton */}
			<div className="space-y-1">
				<Skeleton className="h-8 w-28" />
			</div>
			{/* Section header skeleton */}
			<div>
				<div className="border-b pb-2 mb-4">
					<Skeleton className="h-6 w-36" />
				</div>
				<div>
					{Array.from({ length: 4 }, (_, i) => i).map((i) => (
						<div
							key={`skeleton-row-${i}`}
							className="flex items-center justify-between border-b py-3"
						>
							<Skeleton className="h-4 w-48" />
							<Skeleton className="h-4 w-24" />
						</div>
					))}
				</div>
			</div>
		</PageContainer>
	);
}
