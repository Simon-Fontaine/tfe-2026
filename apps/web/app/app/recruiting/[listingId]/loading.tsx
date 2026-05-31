import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/workspace/page-container";

export default function RecruitingListingLoading() {
	return (
		<div role="status" aria-busy="true">
			<span className="sr-only">Loading</span>
			<PageContainer>
				{/* Breadcrumb + header skeleton */}
				<div className="space-y-1">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-8 w-72" />
				</div>
				{/* Two-column body skeleton */}
				<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
					<div className="col-span-2 space-y-4">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-5/6" />
						<Skeleton className="h-4 w-4/6" />
					</div>
					<div className="space-y-3">
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-full" />
					</div>
				</div>
			</PageContainer>
		</div>
	);
}
