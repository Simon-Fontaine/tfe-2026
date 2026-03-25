import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OrgNotFound() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
			<h2 className="text-xl font-semibold">Organization not found</h2>
			<p className="text-sm text-muted-foreground">
				This organization doesn't exist or you don't have access to it.
			</p>
			<Button asChild variant="outline" size="sm">
				<Link href="/dashboard/workspace">Back to organizations</Link>
			</Button>
		</div>
	);
}
