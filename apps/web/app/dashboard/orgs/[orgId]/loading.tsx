import { Skeleton } from "@/components/ui/skeleton";

export default function OrgLoading() {
	return (
		<div className="space-y-6 p-6">
			<div className="flex items-center gap-4">
				<Skeleton className="size-16" />
				<div className="space-y-2">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-4 w-24" />
				</div>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<Skeleton className="h-32" />
				<Skeleton className="h-32" />
			</div>
		</div>
	);
}
