import Link from "next/link";
import { PublicPageShell } from "@/components/home/public-page-shell";

export default function ContactPage() {
	return (
		<PublicPageShell
			title="Contact Scrimflow"
			description="Use this channel for support, product feedback, and project coordination."
		>
			<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
				Fastest path for product access: create an account first, then include your username and
				team/org context in your message. If you only need immediate functionality, start with{" "}
				<Link href="/teams" className="underline underline-offset-4">
					public team profiles
				</Link>{" "}
				or sign in for dashboard workflows.
			</p>
		</PublicPageShell>
	);
}
