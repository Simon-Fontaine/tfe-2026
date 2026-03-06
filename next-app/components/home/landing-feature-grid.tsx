import {
	Calendar01Icon,
	ChartLineData01Icon,
	FlashIcon,
	Message01Icon,
	SecurityCheckIcon,
	UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
	{
		icon: Calendar01Icon,
		title: "Scrim scheduling",
		description:
			"Schedule scrims with built-in timezone support, availability tracking, and conflict detection.",
	},
	{
		icon: UserGroupIcon,
		title: "Team management",
		description: "Manage rosters, roles, and permissions. Invite players and organize your lineup.",
	},
	{
		icon: ChartLineData01Icon,
		title: "Performance tracking",
		description: "Track match results, map stats, and player performance over time.",
	},
	{
		icon: Message01Icon,
		title: "Team communication",
		description: "Built-in messaging for teams with channels, threads, and file sharing.",
	},
	{
		icon: SecurityCheckIcon,
		title: "Secure by default",
		description: "Two-factor authentication, passkey support, and session management baked in.",
	},
	{
		icon: FlashIcon,
		title: "Lightning fast",
		description: "Optimized for speed on any device. Real-time updates so you never miss a scrim.",
	},
];

export function LandingFeatureGrid() {
	return (
		<section id="features" className="border-b py-14 md:py-20" aria-labelledby="features-heading">
			<div className="mx-auto max-w-6xl px-4">
				<div className="mb-8">
					<h2 id="features-heading" className="text-sm font-bold uppercase tracking-widest">
						Features
					</h2>
					<p className="mt-1 text-xs text-muted-foreground">
						All the tools competitive OW2 teams need to stay organized
					</p>
				</div>

				<div className="grid sm:grid-cols-2 lg:grid-cols-3">
					{features.map((f) => (
						<Card key={f.title} className="-mb-px -mr-px border ring-0">
							<CardHeader>
								<div className="mb-2 flex size-10 items-center justify-center border bg-primary/10">
									<HugeiconsIcon icon={f.icon} strokeWidth={2} className="size-5 text-primary" />
								</div>
								<CardTitle className="text-sm">{f.title}</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		</section>
	);
}
