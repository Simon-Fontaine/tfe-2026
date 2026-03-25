import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function PlayerProfilePage({
	params,
}: {
	params: Promise<{ username: string }>;
}) {
	const { username } = await params;
	return (
		<div className="container mx-auto max-w-2xl space-y-4 py-8">
			<h1 className="text-3xl font-bold">Player profiles are in development</h1>
			<p className="text-muted-foreground leading-relaxed">
				The public profile route for <span className="font-mono">@{username}</span> is not
				implemented yet. Use team profiles and dashboard recruiting flows while this page is under
				development.
			</p>
			<div className="flex flex-wrap gap-2">
				<Button asChild size="sm" variant="outline">
					<Link href="/teams">Browse live public team profiles</Link>
				</Button>
				<Button asChild size="sm">
					<Link href="/auth?step=login">Open dashboard recruiting</Link>
				</Button>
			</div>
		</div>
	);
}
