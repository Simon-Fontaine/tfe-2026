import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function OrgProfilePage({ params }: { params: Promise<{ orgId: string }> }) {
	const { orgId } = await params;
	return (
		<div className="container mx-auto max-w-2xl space-y-4 py-8">
			<h1 className="text-3xl font-bold">Organization profile preview</h1>
			<p className="text-muted-foreground leading-relaxed">
				This route will display organization details for <span className="font-mono">{orgId}</span>,
				including rostered teams and profile metadata.
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
