import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/workspace/page-container";

export default function TeamWorkspaceLoading() {
	return (
		<PageContainer>
			<div className="space-y-1">
				<Skeleton className="h-4 w-16" />
				<div className="flex items-start justify-between gap-4">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-8 w-36" />
				</div>
				<Skeleton className="h-4 w-64" />
			</div>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }, (_, i) => `stat-${i}`).map((key) => (
					<div key={key} className="border p-4 space-y-1">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-7 w-12" />
					</div>
				))}
			</div>
			<div className="space-y-4">
				<Skeleton className="h-6 w-40 border-b pb-2" />
				{Array.from({ length: 3 }, (_, i) => `row-${i}`).map((key) => (
					<div key={key} className="flex items-center justify-between border-b py-3">
						<div className="space-y-1">
							<Skeleton className="h-4 w-48" />
							<Skeleton className="h-3 w-36" />
						</div>
						<Skeleton className="h-5 w-16" />
					</div>
				))}
			</div>
		</PageContainer>
	);
}
