import type { Metadata } from "next";
import { PublicPageShell } from "@/components/home/public-page-shell";

export const metadata: Metadata = {
	title: "Terms of Service",
	description: "Terms governing use of the Scrimflow platform.",
};

export default function TermsPage() {
	return (
		<PublicPageShell
			title="Terms of Service"
			description="These terms govern use of the Scrimflow platform. They are under legal review and will be updated before general availability."
		>
			<p className="text-sm text-muted-foreground">
				If you have questions about account usage rules, contact support for the latest guidance.
			</p>
		</PublicPageShell>
	);
}
