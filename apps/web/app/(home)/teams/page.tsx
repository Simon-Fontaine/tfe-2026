import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export default function TeamsDirectoryPage() {
	return (
		<section className="border-b px-4 py-14 md:py-20" aria-labelledby="teams-heading">
			<div className="mx-auto max-w-6xl space-y-6">
				<div>
					<h1 id="teams-heading" className="text-lg font-bold leading-tight md:text-2xl">
						Teams
					</h1>
					<p className="mt-3 max-w-[48ch] text-xs text-muted-foreground leading-relaxed">
						Discover competitive teams in the ecosystem.
					</p>
				</div>
				<div className="flex flex-col items-center justify-center border p-6 py-16 text-center ring-0 focus-within:ring-0">
					<div className="mb-4 flex size-10 items-center justify-center border bg-primary/10">
						<HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-5 text-primary" />
					</div>
					<p className="text-sm font-bold">No teams found</p>
					<p className="mt-1 text-xs text-muted-foreground">
						The team directory is currently empty.
					</p>
				</div>
			</div>
		</section>
	);
}
