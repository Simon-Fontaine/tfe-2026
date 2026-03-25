import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PlayersDirectoryPage() {
	return (
		<section className="border-b px-4 py-14 md:py-20" aria-labelledby="players-heading">
			<div className="mx-auto max-w-6xl space-y-6">
				<div>
					<h1 id="players-heading" className="text-lg font-bold leading-tight md:text-2xl">
						Players
					</h1>
					<p className="mt-3 max-w-[48ch] text-xs text-muted-foreground leading-relaxed">
						In development: public player discovery is not implemented yet.
					</p>
				</div>
				<div className="flex flex-col items-center justify-center border p-6 py-16 text-center ring-0 focus-within:ring-0">
					<div className="mb-4 flex size-10 items-center justify-center border bg-primary/10">
						<HugeiconsIcon
							icon={UserSearch01Icon}
							strokeWidth={2}
							className="size-5 text-primary"
						/>
					</div>
					<p className="text-sm font-bold">Player directory is not implemented yet</p>
					<p className="mt-1 text-xs text-muted-foreground">
						This page is reserved for a future read-only player directory.
					</p>
					<div className="mt-4 flex flex-wrap justify-center gap-2">
						<Button asChild size="sm" variant="outline">
							<Link href="/teams">Browse available team profiles</Link>
						</Button>
						<Button asChild size="sm">
							<Link href="/auth?step=login">Use dashboard recruiting flows</Link>
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
