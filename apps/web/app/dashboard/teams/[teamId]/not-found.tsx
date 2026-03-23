import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TeamNotFound() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
			<h2 className="text-xl font-semibold">Team not found</h2>
			<p className="text-sm text-muted-foreground">
				This team doesn't exist or you don't have access to it.
			</p>
			<Button asChild variant="outline" size="sm">
				<Link href="/dashboard/teams">Back to teams</Link>
			</Button>
		</div>
	);
}
