import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/workspace/page-container";

export default function RecruitingLoading() {
	return (
		<PageContainer>
			{/* PageHeader skeleton */}
			<div className="flex items-start justify-between gap-4">
				<Skeleton className="h-8 w-36" />
				<Skeleton className="h-8 w-28" />
			</div>
			{/* Filter strip skeleton */}
			<div className="flex gap-2">
				{Array.from({ length: 4 }, (_, i) => `filter-${i}`).map((key) => (
					<Skeleton key={key} className="h-8 w-24" />
				))}
			</div>
			{/* Section header + list rows */}
			<div>
				<div className="border-b pb-2 mb-4">
					<Skeleton className="h-6 w-32" />
				</div>
				<div>
					{Array.from({ length: 3 }, (_, i) => `row-${i}`).map((key) => (
						<div key={key} className="flex items-center justify-between border-b py-4">
							<div className="space-y-1">
								<Skeleton className="h-4 w-64" />
								<Skeleton className="h-3 w-40" />
							</div>
							<Skeleton className="h-4 w-16" />
						</div>
					))}
				</div>
			</div>
		</PageContainer>
	);
}
