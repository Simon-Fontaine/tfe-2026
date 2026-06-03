import { apiRoutes } from "@scrimflow/shared";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LandingFeatureGrid } from "@/components/home/landing-feature-grid";
import { LandingHeroSection } from "@/components/home/landing-hero-section";
import { LandingPrimaryCTASection } from "@/components/home/landing-primary-cta-section";
import { apiGet } from "@/lib/api-client";

export const metadata: Metadata = {
	title: "Scrimflow — Overwatch 2 Team Management",
	description:
		"Manage your Overwatch 2 team, coordinate scrims, and recruit players from a shared workspace.",
};

export default function Page() {
	return (
		<>
			<LandingHeroSection />
			<section className="border-b py-12 px-6" aria-label="Platform statistics">
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
