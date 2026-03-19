import { LockIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const stats = [
	{ value: "500+", label: "Teams registered" },
	{ value: "10k+", label: "Scrims coordinated" },
	{ value: "99.9%", label: "Uptime" },
	{ value: "4.9★", label: "User rating" },
];

export function LandingTrustSection() {
	return (
		<section className="mx-auto max-w-6xl px-4 py-10 md:py-14" aria-label="Platform statistics">
			<div className="grid grid-cols-2 md:grid-cols-4">
				{stats.map((s) => (
					<div key={s.label} className="-mb-px -mr-px border p-4 text-center">
						<dd className="text-sm font-bold text-primary">{s.value}</dd>
						<dt className="mt-0.5 text-xs text-muted-foreground">{s.label}</dt>
					</div>
				))}
			</div>
			<p className="mt-4 text-xs text-muted-foreground">
				<HugeiconsIcon icon={LockIcon} strokeWidth={2} className="mr-1 inline-block size-3" />
				Secured with enterprise-grade authentication and encryption
			</p>
		</section>
	);
}
