import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-7 w-36" />
					<Skeleton className="h-4 w-56" />
				</div>
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{["stat-skel-1", "stat-skel-2", "stat-skel-3", "stat-skel-4"].map((key) => (
						<Skeleton key={key} className="h-28" />
					))}
				</div>
				<div className="grid gap-3 lg:grid-cols-3">
					<Skeleton className="h-72 lg:col-span-2" />
					<Skeleton className="h-72" />
				</div>
			</div>
		</div>
	);
}
