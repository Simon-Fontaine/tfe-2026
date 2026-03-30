import type { Metadata } from "next";
import { LandingFeatureGrid } from "@/components/home/landing-feature-grid";

export const metadata: Metadata = {
	title: "Scrimflow — Overwatch 2 Team Management",
	description:
		"Manage your Overwatch 2 team, coordinate scrims, and recruit players from a shared workspace.",
};

import { LandingHeroSection } from "@/components/home/landing-hero-section";
import { LandingPrimaryCTASection } from "@/components/home/landing-primary-cta-section";

export default function Page() {
	return (
		<>
			<LandingHeroSection />
			<LandingFeatureGrid />
			<LandingPrimaryCTASection />
		</>
	);
}
