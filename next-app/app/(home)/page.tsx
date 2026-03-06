import { LandingFeatureGrid } from "@/components/home/landing-feature-grid";
import { LandingHeroSection } from "@/components/home/landing-hero-section";
import { LandingPrimaryCTASection } from "@/components/home/landing-primary-cta-section";
import { siteConfig } from "@/lib/config/site";

export default function Page() {
	return (
		<>
			<LandingHeroSection />
			<LandingFeatureGrid />
			<LandingPrimaryCTASection />
			<footer className="border-t py-8 text-xs">
				<div className="mx-auto max-w-6xl px-4 text-muted-foreground sm:px-6">
					&copy; {new Date().getFullYear()} {siteConfig.footer.copyright} &middot; All rights
					reserved
				</div>
			</footer>
		</>
	);
}
