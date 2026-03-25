export default function AboutPage() {
	return (
		<div className="container mx-auto max-w-2xl space-y-4 py-8">
			<h1 className="text-3xl font-bold">About Scrimflow</h1>
			<p className="text-muted-foreground leading-relaxed">
				Scrimflow helps Overwatch 2 teams run day-to-day operations: roster management, recruiting,
				and schedule coordination from a shared workspace.
			</p>
			<p className="text-muted-foreground leading-relaxed">
				Current public surface area is intentionally limited. Team previews are public now, while
				player, organization, and scrim listing pages are still under development.
			</p>
		</div>
	);
}
