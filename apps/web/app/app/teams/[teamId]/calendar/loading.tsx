import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/workspace/page-container";

export default function TeamCalendarLoading() {
	return (
		<PageContainer>
			<div className="space-y-1">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-8 w-36" />
			</div>
			<div className="space-y-4">
				<Skeleton className="h-6 w-40" />
				{Array.from({ length: 3 }, (_, i) => `scrim-${i}`).map((key) => (
					<div key={key} className="flex items-center justify-between border py-3 px-4">
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-5 w-20" />
					</div>
				))}
			</div>
			<div className="space-y-2">
				<Skeleton className="h-6 w-32" />
				<Skeleton className="h-64 w-full" />
			</div>
		</PageContainer>
	);
}
