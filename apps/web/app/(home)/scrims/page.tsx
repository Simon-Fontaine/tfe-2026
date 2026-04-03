import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	title: "Scrims",
	description: "Browse upcoming Overwatch 2 scrims and open practice requests.",
};

export default function ScrimsDirectoryPage() {
	return (
		<PublicPageShell
			title="Scrims"
			description="Browse upcoming scrims and open practice requests."
			maxWidth="6xl"
			contentClassName="space-y-6"
		>
			<EmptyStateBlock
				icon={UserSearch01Icon}
				title="Scrim listings coming soon"
				description="Scrim board entries will appear here once listing sync is enabled."
				actionLabel="Go to dashboard"
				actionHref="/dashboard"
				variant="page"
			/>
			<div className="flex justify-center">
				<Button asChild size="sm" variant="outline">
					<Link href="/auth?step=login">Sign in to access dashboard scheduling</Link>
				</Button>
			</div>
		</PublicPageShell>
	);
}
