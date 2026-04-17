import type { Metadata } from "next";
import { PublicPageShell } from "@/components/home/public-page-shell";

export const metadata: Metadata = {
	title: "About",
	description:
		"Scrimflow helps Overwatch 2 teams run day-to-day operations from a shared workspace.",
};

export default function AboutPage() {
	return (
		<PublicPageShell
			title="About Scrimflow"
			description="Scrimflow helps Overwatch 2 teams run day-to-day operations: roster management, recruiting, and schedule coordination from a shared workspace."
		>
			<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
				The platform provides organization and team workspaces, player profiles, recruitment
				listings with conversations, availability tracking, and scrim scheduling — all built around
				the Overwatch 2 competitive ecosystem.
			</p>
		</PublicPageShell>
	);
}
