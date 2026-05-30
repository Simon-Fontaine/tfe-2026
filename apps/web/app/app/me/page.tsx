import { UserCircle02Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { getPersonalHomeData } from "@/lib/data/personal-home";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

function SectionError({ title, error }: { title: string; error: string }) {
	return (
		<Alert variant="destructive">
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>{error}</AlertDescription>
		</Alert>
	);
}

export default async function AppMePage() {
	const { user } = await requireWorkspaceSession();
	const data = await getPersonalHomeData(user.id);

	const profile = data.profile.status === "success" ? data.profile.data : null;
	const orgs = data.orgs.status === "success" ? data.orgs.data : [];
	const teams = data.teams.status === "success" ? data.teams.data : [];

	const metaParts: string[] = [];
	if (profile?.battletag) metaParts.push(profile.battletag);
	if (profile?.primaryRole) metaParts.push(profile.primaryRole);
	if (profile?.rank && profile?.rankDivision != null) {
		metaParts.push(`${profile.rank} ${profile.rankDivision}`);
	} else if (profile?.rank) {
		metaParts.push(profile.rank);
	}

	const hasNoWorkspaces = orgs.length === 0 && teams.length === 0;

	return (
		<PageContainer>
			<PageHeader
				title={user.displayName}
				meta={metaParts.length > 0 ? <span>{metaParts.join(" · ")}</span> : undefined}
			/>

			{data.orgs.status === "error" ? (
				<SectionError title="Organizations could not be loaded" error={data.orgs.error} />
			) : null}
			{data.teams.status === "error" ? (
				<SectionError title="Teams could not be loaded" error={data.teams.error} />
			) : null}

			{hasNoWorkspaces ? (
				<EmptyState
					icon={UserCircle02Icon}
					title="No teams or organizations yet"
					action={
						<div className="flex gap-2">
							<Button asChild size="sm">
								<Link href={appRoutes.orgs.root}>Create org</Link>
							</Button>
							<Button asChild size="sm" variant="outline">
								<Link href={appRoutes.recruiting.root}>Browse recruiting</Link>
							</Button>
						</div>
					}
				/>
			) : (
				<div className="space-y-8">
					{teams.length > 0 && (
						<section>
							<h2 className="text-lg font-semibold border-b pb-2 mb-4">Teams</h2>
							<div className="divide-y border">
								{teams.map((team) => (
									<div
										key={team.id}
										className="flex items-center justify-between px-4 py-3 text-sm"
									>
										<span className="font-medium">
											[{team.tag}] {team.name}
										</span>
										<Button asChild size="sm" variant="outline">
											<Link href={appRoutes.teams.byId(team.id)}>Open</Link>
										</Button>
									</div>
								))}
							</div>
						</section>
					)}

					{orgs.length > 0 && (
						<section>
							<h2 className="text-lg font-semibold border-b pb-2 mb-4">Organizations</h2>
							<div className="divide-y border">
								{orgs.map((org) => (
									<div key={org.id} className="flex items-center justify-between px-4 py-3 text-sm">
										<div>
											<span className="font-medium">{org.name}</span>
											<span className="ml-2 text-xs text-muted-foreground">
												{org.role} · {org.teamCount} teams
											</span>
										</div>
										<Button asChild size="sm" variant="outline">
											<Link href={appRoutes.orgs.byId(org.id)}>Open</Link>
										</Button>
									</div>
								))}
							</div>
						</section>
					)}
				</div>
			)}
		</PageContainer>
	);
}
