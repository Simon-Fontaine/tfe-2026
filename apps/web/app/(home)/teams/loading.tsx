import { Skeleton } from "@/components/ui/skeleton";

export default function TeamsLoading() {
	return (
		<section className="border-b px-4 py-14 md:py-20">
			<div className="mx-auto max-w-6xl">
				<div className="flex flex-col gap-3">
					<Skeleton className="h-7 w-24" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<div className="mt-6 flex flex-col gap-3">
					<Skeleton className="h-9 w-full" />
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{[
							"team-skel-1",
							"team-skel-2",
							"team-skel-3",
							"team-skel-4",
							"team-skel-5",
							"team-skel-6",
						].map((key) => (
							<Skeleton key={key} className="h-40" />
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
