import { Calendar03Icon, UserGroup02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getActiveTeamsForUser } from "@/lib/data/player";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppCalendarPage() {
	const { user } = await requireWorkspaceSession();

	const teams = await getActiveTeamsForUser(user.id);
	if (teams.length === 0) {
		return (
			<PageContainer>
				<PageHeader
					title="Personal schedule"
					description="Team-scoped availability will appear here once you join a team."
				/>
				<EmptyStateBlock
					icon={UserGroup02Icon}
					title="Nothing scheduled"
					description="Your personal schedule will appear here once you join a team."
					variant="card"
				/>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title="Personal schedule"
				description="Your availability is managed per team. Choose a team calendar to review shared availability and edit your windows."
			/>
			<div className="space-y-6">
				<section className="border p-5">
					<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
						<div>
							<h2 className="text-sm font-semibold">Team calendars</h2>
							<p className="mt-1 max-w-[64ch] text-sm text-muted-foreground">
								ScrimFlow keeps scheduling tied to a concrete team so availability edits always
								apply to the right roster.
							</p>
						</div>
						<Button asChild size="sm" variant="outline">
							<Link href={appRoutes.orgs.root}>Manage organizations</Link>
						</Button>
					</div>
				</section>

				<div className="grid gap-3 md:grid-cols-2">
					{teams.map((team) => (
						<Link
							key={team.id}
							href={appRoutes.teams.calendar(team.id)}
							className="flex items-start gap-3 border p-4 transition-colors hover:bg-muted/50"
						>
							<div className="flex size-9 shrink-0 items-center justify-center bg-primary/10 text-primary">
								<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-4" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-semibold">
									[{team.tag}] {team.name}
								</p>
								<p className="mt-1 text-sm text-muted-foreground">
									Open team schedule and edit your availability for this roster.
								</p>
							</div>
						</Link>
					))}
				</div>
			</div>
		</PageContainer>
	);
}
