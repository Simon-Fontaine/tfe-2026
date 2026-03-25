import { Skeleton } from "@/components/ui/skeleton";

export default function TeamLoading() {
	return (
		<div className="space-y-6 p-6">
			<div className="flex items-center gap-4">
				<Skeleton className="size-16" />
				<div className="space-y-2">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-4 w-24" />
				</div>
			</div>
			<Skeleton className="h-48" />
		</div>
	);
}
