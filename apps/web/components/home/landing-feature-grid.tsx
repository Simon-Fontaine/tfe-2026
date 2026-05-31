import {
	Calendar01Icon,
	ChartLineData01Icon,
	FlashIcon,
	Message01Icon,
	SecurityCheckIcon,
	UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const features = [
	{
		icon: Calendar01Icon,
		title: "Scrim scheduling",
		description:
			"Request scrims directly from team pages, set availability windows, and confirm results — no Discord back-and-forth needed.",
	},
	{
		icon: UserGroupIcon,
		title: "Team management",
		description:
			"Manage rosters with role assignments, issue invites, set permissions per member, and track active vs. inactive status.",
	},
	{
		icon: ChartLineData01Icon,
		title: "Recruiting market",
		description:
			"Post open player, staff, and org listings. Browse by role, rank, and region. Apply directly through the platform.",
	},
	{
		icon: Message01Icon,
		title: "Team communication",
		description:
			"Built-in team chat with scrim-linked channels. Keep match discussions attached to the scrim they belong to.",
	},
	{
		icon: SecurityCheckIcon,
		title: "Secure by default",
		description:
			"Passkeys, TOTP, hardware security key, and recovery code support. Session management and device verification built in.",
	},
	{
		icon: FlashIcon,
		title: "Rating system",
		description:
			"Glicko-based team ratings update automatically after both teams confirm a scrim result. Track momentum over time.",
	},
];

export function LandingFeatureGrid() {
	return (
		<section id="features" className="border-b py-12 px-6" aria-labelledby="features-heading">
			<div className="mx-auto max-w-6xl">
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
						<div key={f.title} className="-mb-px -mr-px border p-4">
							<div className="mb-2 flex size-10 items-center justify-center border bg-primary/10">
								<HugeiconsIcon icon={f.icon} strokeWidth={2} className="size-5 text-primary" />
							</div>
							<p className="text-sm font-bold">{f.title}</p>
							<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
