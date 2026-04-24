import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LandingFeatureGrid } from "@/components/home/landing-feature-grid";
import { LandingHeroSection } from "@/components/home/landing-hero-section";
import { LandingPrimaryCTASection } from "@/components/home/landing-primary-cta-section";
import { PublicPageSection } from "@/components/home/public-page-section";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api-client";
import { apiRoutes } from "@/lib/routes";

export const metadata: Metadata = {
	title: "Scrimflow — Overwatch 2 Team Management",
	description:
		"Manage your Overwatch 2 team, coordinate scrims, and recruit players from a shared workspace.",
};

export default function Page() {
	return (
		<>
			<LandingHeroSection />
			<section className="border-b px-4 py-8" aria-label="Platform statistics">
				<div className="mx-auto max-w-6xl">
					<p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
						Platform activity
					</p>
					<Suspense fallback={<PlatformStatsFallback />}>
						<PlatformStatsSection />
					</Suspense>
				</div>
			</section>
			<LandingFeatureGrid />
			<section className="border-b px-4 py-14 md:py-20" aria-labelledby="public-funnel-heading">
				<div className="mx-auto max-w-6xl space-y-10">
					<PublicPageSection
						title="Explore the public product"
						description="Scrimflow is not just a sign-up page. Teams, orgs, players, recruiting, scrims, and updates all have public surfaces that help visitors understand the ecosystem before they join."
						actions={
							<Button asChild size="sm" variant="outline">
								<Link href="/recruiting">
									Start with recruiting
									<HugeiconsIcon
										icon={ArrowRight01Icon}
										strokeWidth={2}
										className="ml-1.5 size-3.5"
									/>
								</Link>
							</Button>
						}
					>
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{[
								[
									"Recruiting",
									"/recruiting",
									"Browse open player, team, and staff opportunities with clear next actions.",
								],
								["Teams", "/teams", "See team profiles, recruiting status, and roster depth."],
								[
									"Organizations",
									"/orgs",
									"Discover org-backed programs and the teams they operate.",
								],
								["Players", "/players", "Evaluate role focus, rank, and current availability."],
								[
									"Scrims",
									"/scrims",
									"Follow public scheduling, scorelines, and confirmation state.",
								],
								[
									"Updates",
									"/updates",
									"Track team and org announcements outside recruiting noise.",
								],
							].map(([label, href, description]) => (
								<Link
									key={href}
									href={href}
									className="flex min-h-32 flex-col justify-between border p-4 transition-colors hover:bg-muted/50"
								>
									<div>
										<p className="text-sm font-semibold">{label}</p>
										<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
											{description}
										</p>
									</div>
									<p className="mt-4 text-xs font-medium text-primary">
										Open {label.toLowerCase()}
									</p>
								</Link>
							))}
						</div>
					</PublicPageSection>

					<PublicPageSection
						title="Know how the platform works before you sign in"
						description="The trust pages below explain what Scrimflow is, how support is handled, and what account and data expectations are today."
					>
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							{[
								[
									"About",
									"/about",
									"Product scope, who it is for, and how the public/app surfaces fit together.",
								],
								[
									"Contact",
									"/contact",
									"Support path, account-first reporting flow, and how to get unblocked quickly.",
								],
								[
									"Privacy",
									"/privacy",
									"What account, profile, and workspace information is stored to run the product.",
								],
								[
									"Terms",
									"/terms",
									"The operating rules for using the platform and keeping team spaces healthy.",
								],
							].map(([label, href, description]) => (
								<Link
									key={href}
									href={href}
									className="flex min-h-32 flex-col justify-between border p-4 transition-colors hover:bg-muted/50"
								>
									<div>
										<p className="text-sm font-semibold">{label}</p>
										<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
											{description}
										</p>
									</div>
									<p className="mt-4 text-xs font-medium text-primary">
										Read {label.toLowerCase()}
									</p>
								</Link>
							))}
						</div>
					</PublicPageSection>
				</div>
			</section>
			<LandingPrimaryCTASection />
		</>
	);
}

async function PlatformStatsSection() {
	try {
		const res = await apiGet<{ teamCount: number; scrimsPlayed: number; openListingCount: number }>(
			apiRoutes.publicStats
		);
		if (!("data" in res)) {
			return <PlatformStatsFallback />;
		}
		const { teamCount, scrimsPlayed, openListingCount } = res.data;
		return (
			<div className="grid grid-cols-3">
				{[
					{ label: "Teams", value: teamCount },
					{ label: "Scrims played", value: scrimsPlayed },
					{ label: "Open listings", value: openListingCount },
				].map((stat) => (
					<div key={stat.label} className="-mb-px -mr-px border p-4 text-center">
						<dd className="text-sm font-bold text-primary">{stat.value.toLocaleString()}</dd>
						<dt className="mt-0.5 text-xs text-muted-foreground">{stat.label}</dt>
					</div>
				))}
			</div>
		);
	} catch {
		return <PlatformStatsFallback />;
	}
}

function PlatformStatsFallback() {
	return (
		<div className="grid grid-cols-3">
			{[
				{ label: "Teams", value: "—" },
				{ label: "Scrims played", value: "—" },
				{ label: "Open listings", value: "—" },
			].map((stat) => (
				<div key={stat.label} className="-mb-px -mr-px border p-4 text-center">
					<dd className="text-sm font-bold text-primary">{stat.value}</dd>
					<dt className="mt-0.5 text-xs text-muted-foreground">{stat.label}</dt>
				</div>
			))}
		</div>
	);
}
