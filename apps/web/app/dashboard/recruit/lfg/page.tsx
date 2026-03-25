import { ArrowRight01Icon, UserSearch01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { LfgPostCard } from "@/components/lfg/lfg-post-card";
import { SettingsHeaderBar } from "@/components/settings/settings-header-bar";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getOpenLfgPosts } from "@/lib/data/lfg";

export default async function LfgPage() {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const teamPosts = await getOpenLfgPosts({ type: "team_seeking_player" });

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<SettingsHeaderBar
				backHref="/dashboard"
				icon={UserSearch01Icon}
				title="Recruit LFG"
				subtitle="Find a team to join"
			/>

			<div className="flex items-center justify-between gap-2 border p-3">
				<p className="text-xs text-muted-foreground">
					Track your submitted applications in the dedicated applications view.
				</p>
				<Button asChild size="sm" variant="outline" className="shrink-0">
					<Link href="/dashboard/recruit/applications">
						Applications
						<HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" strokeWidth={2} />
					</Link>
				</Button>
			</div>

			{teamPosts.length === 0 ? (
				<EmptyState message="No teams are currently looking for players." />
			) : (
				<div className="flex flex-col gap-3">
					{teamPosts.map((post) => (
						<LfgPostCard key={post.id} post={post} currentUserId={user.id} />
					))}
				</div>
			)}
		</div>
	);
}

function EmptyState({ message }: { message: string }) {
	return (
		<div className="flex flex-col items-center justify-center border border-dashed px-6 py-10 text-center">
			<HugeiconsIcon
				icon={UserSearch01Icon}
				strokeWidth={1.5}
				className="mb-4 size-10 text-muted-foreground/40"
			/>
			<p className="text-sm text-muted-foreground">{message}</p>
		</div>
	);
}
