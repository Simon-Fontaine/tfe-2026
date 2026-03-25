import { LandingFeatureGrid } from "@/components/home/landing-feature-grid";
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
