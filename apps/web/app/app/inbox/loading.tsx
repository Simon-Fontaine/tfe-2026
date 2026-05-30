import { Skeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
	return (
		<div className="grid h-full grid-cols-[300px_minmax(0,1fr)]">
			{/* Left panel skeleton */}
			<div className="flex flex-col border-r">
				<div className="flex items-center justify-between border-b p-4">
					<Skeleton className="h-8 w-20" />
					<Skeleton className="h-8 w-28" />
				</div>
				<div className="border-b p-3">
					<Skeleton className="h-8 w-full" />
				</div>
				<div className="flex flex-col">
					{Array.from({ length: 8 }, (_, i) => i).map((i) => (
						<div key={`skeleton-row-${i}`} className="flex gap-3 border-b p-3">
							<Skeleton className="size-2 mt-1 shrink-0" />
							<div className="flex-1 space-y-1.5">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-3 w-1/2" />
							</div>
						</div>
					))}
				</div>
			</div>
			{/* Right panel skeleton */}
			<div className="flex items-center justify-center">
				<Skeleton className="h-8 w-48" />
			</div>
		</div>
	);
}
