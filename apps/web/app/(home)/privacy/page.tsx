import { PublicPageShell } from "@/components/home/public-page-shell";

export default function PrivacyPage() {
	return (
		<PublicPageShell
			title="Privacy Policy"
			description="This is the public privacy policy placeholder while data retention and regional compliance details are being finalized for general availability."
		>
			<p className="text-sm text-muted-foreground">
				For data access or deletion requests, contact support with your account details and request
				scope.
			</p>
		</PublicPageShell>
	);
}
