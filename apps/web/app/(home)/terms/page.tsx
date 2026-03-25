import { PublicPageShell } from "@/components/home/public-page-shell";

export default function TermsPage() {
	return (
		<PublicPageShell
			title="Terms of Service"
			description="This page is the public terms placeholder while legal review is finalized for broader public launch."
		>
			<p className="text-sm text-muted-foreground">
				If you have questions about account usage rules, contact support for the latest guidance.
			</p>
		</PublicPageShell>
	);
}
