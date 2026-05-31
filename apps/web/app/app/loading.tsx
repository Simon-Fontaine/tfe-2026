import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
	return (
		<div className="p-6 space-y-8" role="status" aria-busy="true">
			<span className="sr-only">Loading</span>
			<div className="flex items-start justify-between gap-4">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-9 w-28" />
			</div>
			<Skeleton className="h-48 w-full" />
			<Skeleton className="h-32 w-full" />
		</div>
	);
}
