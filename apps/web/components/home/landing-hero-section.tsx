import { ArrowRight01Icon, LockIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";

const stats = [
	{ value: "500+", label: "Teams registered" },
	{ value: "10k+", label: "Scrims coordinated" },
	{ value: "99.9%", label: "Uptime" },
	{ value: "4.9\u2605", label: "User rating" },
];

export function LandingHeroSection() {
	return (
		<section className="border-b px-4 py-14 md:py-20" aria-labelledby="hero-heading">
			<div className="mx-auto max-w-6xl">
				<div className="grid gap-10 md:grid-cols-2 md:items-center">
					<div>
						<div className="mb-4 flex size-10 items-center justify-center border bg-primary/10">
							<HugeiconsIcon
								icon={siteConfig.logo}
								strokeWidth={2}
								className="size-5 text-primary"
							/>
						</div>
						<h1 id="hero-heading" className="text-lg font-bold leading-tight md:text-2xl">
							Your Overwatch 2 team,
							<br />
							organized &amp; ready to compete
						</h1>
						<p className="mt-3 max-w-[48ch] text-xs text-muted-foreground leading-relaxed">
							{siteConfig.name} is the team management and scrim coordination platform built for
							competitive OW2 teams. Schedule, communicate, and improve — all in one place.
						</p>
						<div className="mt-6 flex items-center gap-2">
							<Button asChild>
								<Link href="/auth?step=register">
									Get started free
									<HugeiconsIcon
										icon={ArrowRight01Icon}
										strokeWidth={2}
										className="ml-1.5 size-3.5"
									/>
								</Link>
							</Button>
							<Button asChild variant="outline">
								<Link href="#features">See features</Link>
							</Button>
						</div>
					</div>
					<div>
						<div className="grid grid-cols-2">
							{stats.map((s) => (
								<div key={s.label} className="-mb-px -mr-px border p-4 text-center">
									<dd className="text-sm font-bold text-primary">{s.value}</dd>
									<dt className="mt-0.5 text-xs text-muted-foreground">{s.label}</dt>
								</div>
							))}
						</div>
						<p className="mt-3 text-xs text-muted-foreground">
							<HugeiconsIcon icon={LockIcon} strokeWidth={2} className="mr-1 inline-block size-3" />
							Secured with enterprise-grade authentication and encryption
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
