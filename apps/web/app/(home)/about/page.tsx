import { PublicPageShell } from "@/components/home/public-page-shell";

export default function AboutPage() {
	return (
		<PublicPageShell
			title="About Scrimflow"
			description="Scrimflow helps Overwatch 2 teams run day-to-day operations: roster management, recruiting, and schedule coordination from a shared workspace."
		>
			<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
				Profiles, recruiting, and scrim discovery routes are being assembled to support end-to-end
				team workflows.
			</p>
		</PublicPageShell>
	);
}
