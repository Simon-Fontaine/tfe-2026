import { Skeleton } from "@/components/ui/skeleton";

export default function PlayersLoading() {
	return (
		<div className="space-y-6 p-6">
			<Skeleton className="h-8 w-32" />
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Skeleton className="h-40" />
				<Skeleton className="h-40" />
				<Skeleton className="h-40" />
				<Skeleton className="h-40" />
				<Skeleton className="h-40" />
				<Skeleton className="h-40" />
			</div>
		</div>
	);
}
