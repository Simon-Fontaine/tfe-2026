import { UserGroupIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";

export default function TeamNotFound() {
	return (
		<PageContainer>
			<EmptyState
				icon={UserGroupIcon}
				title="Team not found."
				action={
					<Button asChild size="sm" variant="outline">
						<Link href="/app">Back to home</Link>
					</Button>
				}
			/>
		</PageContainer>
	);
}
