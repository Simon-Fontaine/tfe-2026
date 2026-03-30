import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	title: "Scrims",
	description: "Browse upcoming Overwatch 2 scrims and open practice requests.",
};

export default function ScrimsDirectoryPage() {
	return (
		<section className="border-b px-4 py-14 md:py-20" aria-labelledby="scrims-heading">
			<div className="mx-auto max-w-6xl space-y-6">
				<div>
					<h1 id="scrims-heading" className="text-lg font-bold leading-tight md:text-2xl">
						Scrims
					</h1>
					<p className="mt-3 max-w-[48ch] text-xs text-muted-foreground leading-relaxed">
						Browse upcoming scrims and open practice requests.
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
					<p className="text-sm font-bold">Scrim listings coming soon</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Scrim board entries will appear here once listing sync is enabled.
					</p>
					<div className="mt-4 flex flex-wrap justify-center gap-2">
						<Button asChild size="sm" variant="outline">
							<Link href="/auth?step=login">Sign in to access dashboard scheduling</Link>
						</Button>
						<Button asChild size="sm">
							<Link href="/dashboard">Go to dashboard</Link>
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
