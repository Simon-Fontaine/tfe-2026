import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";

export function LandingPrimaryCTASection() {
	return (
		<section aria-labelledby="cta-heading" className="border-b px-4 py-14 md:py-20">
			<div className="mx-auto max-w-6xl">
				<div className="grid items-center gap-6 border p-6 md:grid-cols-[1fr_auto] md:p-8">
					<div>
						<h2 id="cta-heading" className="text-sm font-bold">
							Ready to level up your team?
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							Join {siteConfig.name} today — it&apos;s free to get started. No credit card required.
						</p>
					</div>
					<Button asChild>
						<Link href="/auth?step=register">
							Create your team
							<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="ml-1.5 size-3.5" />
						</Link>
					</Button>
				</div>
			</div>
		</section>
	);
}
