import Link from "next/link";

export default function ContactPage() {
	return (
		<div className="container mx-auto max-w-2xl space-y-4 py-8">
			<h1 className="text-3xl font-bold">Contact Scrimflow</h1>
			<p className="text-muted-foreground leading-relaxed">
				Use this channel for support, product feedback, and project coordination.
			</p>
			<p className="text-sm text-muted-foreground">
				Fastest path for product access: create an account first, then include your username and
				team/org context in your message. If you only need immediate functionality, start with{" "}
				<Link href="/teams" className="underline underline-offset-4">
					public team profiles
				</Link>{" "}
				or sign in for dashboard workflows.
			</p>
		</div>
	);
}
