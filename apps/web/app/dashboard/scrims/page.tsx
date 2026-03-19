import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LfgPostCard } from "@/components/lfg/lfg-post-card";
import { SettingsHeaderBar } from "@/components/settings/settings-header-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentSession } from "@/lib/auth/session";
import { getOpenLfgPosts, getUserApplications } from "@/lib/data/lfg";

export default async function LfgPage() {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const [teamPosts, myApplications] = await Promise.all([
		getOpenLfgPosts({ type: "team_seeking_player" }),
		getUserApplications(user.id),
	]);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<SettingsHeaderBar
				backHref="/dashboard"
				icon={UserSearch01Icon}
				title="Looking for Group"
				subtitle="Find a team to join"
			/>

			<Tabs defaultValue="teams">
				<TabsList className="w-full">
					<TabsTrigger value="teams" className="flex-1">
						Teams Looking ({teamPosts.length})
					</TabsTrigger>
					<TabsTrigger value="mine" className="flex-1">
						My Applications ({myApplications.length})
					</TabsTrigger>
				</TabsList>

				<TabsContent value="teams" className="mt-4 space-y-3">
					{teamPosts.length === 0 ? (
						<EmptyState message="No teams are currently looking for players." />
					) : (
						teamPosts.map((post) => (
							<LfgPostCard key={post.id} post={post} currentUserId={user.id} />
						))
					)}
				</TabsContent>

				<TabsContent value="mine" className="mt-4 space-y-3">
					{myApplications.length === 0 ? (
						<EmptyState message="You haven't applied to any posts yet." />
					) : (
						myApplications.map((app) => (
							<div key={app.id} className="flex items-center justify-between border px-4 py-3">
								<div>
									<p className="text-sm font-medium">
										{app.teamName ? `[${app.teamTag}] ${app.teamName}` : "Player post"}
									</p>
									{app.message && (
										<p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
											{app.message}
										</p>
									)}
								</div>
								<span className="text-xs text-muted-foreground capitalize">{app.status}</span>
							</div>
						))
					)}
				</TabsContent>
			</Tabs>
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
