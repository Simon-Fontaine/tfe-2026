import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function OrgProfilePage({ params }: { params: Promise<{ orgId: string }> }) {
	const { orgId } = await params;
	return (
		<div className="container mx-auto max-w-2xl space-y-4 py-8">
			<h1 className="text-3xl font-bold">Organization profiles are in development</h1>
			<p className="text-muted-foreground leading-relaxed">
				Public page access for organization <span className="font-mono">{orgId}</span> is not
				implemented yet. Use team profiles and workspace routes while this page is under
				development.
			</p>
			<div className="flex flex-wrap gap-2">
				<Button asChild size="sm" variant="outline">
					<Link href="/teams">Use team profiles for current public discovery</Link>
				</Button>
				<Button asChild size="sm">
					<Link href="/auth?step=login">Open workspace dashboard</Link>
				</Button>
			</div>
		</div>
	);
}
