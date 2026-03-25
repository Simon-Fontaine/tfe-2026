import { Skeleton } from "@/components/ui/skeleton";

export default function PlayersLoading() {
	return (
		<section className="border-b px-4 py-14 md:py-20">
			<div className="mx-auto max-w-6xl">
				<div className="flex flex-col gap-3">
					<Skeleton className="h-7 w-28" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<div className="mt-6 border p-6 py-16">
					<div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
						<Skeleton className="size-10" />
						<Skeleton className="h-5 w-56 max-w-full" />
						<Skeleton className="h-4 w-72 max-w-full" />
						<div className="mt-1 flex w-full justify-center gap-2">
							<Skeleton className="h-9 w-48" />
							<Skeleton className="h-9 w-52" />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
