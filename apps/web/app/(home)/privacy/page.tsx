import type { Metadata } from "next";
import { PublicPageShell } from "@/components/home/public-page-shell";

export const metadata: Metadata = {
	title: "Privacy Policy",
	description: "How Scrimflow collects, uses, and protects your data.",
};

export default function PrivacyPage() {
	return (
		<PublicPageShell
			title="Privacy Policy"
			description="This policy describes how Scrimflow collects, uses, and protects your data. It is under active review and will be updated before general availability."
		>
			<p className="text-sm text-muted-foreground">
				For data access or deletion requests, contact support with your account details and request
				scope.
			</p>
		</PublicPageShell>
	);
}
