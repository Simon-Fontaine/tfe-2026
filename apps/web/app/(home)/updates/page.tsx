import { Notification01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { UpdatePostCard } from "@/components/updates/update-post-card";
import { getCurrentSession } from "@/lib/auth/session";
import { getPublicUpdates } from "@/lib/data/updates";

export const metadata: Metadata = {
	title: "Updates",
	description: "Team and organization announcements published through Scrimflow.",
};

export default async function UpdatesPage() {
	const { user } = await getCurrentSession();
	const updates = await getPublicUpdates();

	return (
		<PublicPageShell
			title="Updates"
			description="Team and organization announcements now have a dedicated feed separate from recruiting."
			maxWidth="5xl"
			contentClassName="space-y-6"
			actions={
				<Button asChild size="sm">
					<Link href={user ? "/app" : "/auth?step=login"}>
						{user ? "Open app workspace" : "Sign in to publish updates"}
					</Link>
				</Button>
			}
		>
			{updates.length === 0 ? (
				<EmptyStateBlock
					icon={Notification01Icon}
					title="No public updates yet"
					description="Public team announcements will appear here once managers start publishing into the new updates feed."
					variant="page"
				/>
			) : (
				<div className="space-y-3">
					{updates.map((post) => (
						<UpdatePostCard key={post.id} post={post} showScopeLink />
					))}
				</div>
			)}
		</PublicPageShell>
	);
}
