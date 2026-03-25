import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import { SettingsHeaderBar } from "@/components/settings/settings-header-bar";
import { getCurrentSession } from "@/lib/auth/session";
import { getUserApplications } from "@/lib/data/lfg";

export default async function ApplicationsPage() {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const myApplications = await getUserApplications(user.id);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<SettingsHeaderBar
				backHref="/dashboard"
				icon={UserSearch01Icon}
				title="Recruit Applications"
				subtitle="Track your active and past applications"
			/>

			{myApplications.length === 0 ? (
				<div className="flex flex-col items-center justify-center border border-dashed px-6 py-10 text-center">
					<p className="text-sm text-muted-foreground">You haven't applied to any posts yet.</p>
				</div>
			) : (
				<div className="space-y-3">
					{myApplications.map((app) => (
						<div key={app.id} className="flex items-center justify-between border px-4 py-3">
							<div>
								<p className="text-sm font-medium">
									{app.teamName ? `[${app.teamTag}] ${app.teamName}` : "Player post"}
								</p>
								{app.message && (
									<p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{app.message}</p>
								)}
							</div>
							<span className="text-xs text-muted-foreground capitalize">{app.status}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
