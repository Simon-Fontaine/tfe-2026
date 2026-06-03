import { UserGroup02Icon } from "@hugeicons/core-free-icons";
import { appRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/workspace/page-container";
import { getActiveTeamsForUser } from "@/lib/data/player";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppCalendarPage() {
	const { user } = await requireWorkspaceSession();

	const teams = await getActiveTeamsForUser(user.id);
	if (teams.length === 0) {
		return (
			<PageContainer>
				<PageHeader title="Calendar" />
				<EmptyState icon={UserGroup02Icon} title="You are not on any teams yet." />
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader title="Calendar" />
			<div>
				<h2 className="text-lg font-semibold border-b pb-2 mb-4">Team calendars</h2>
				<div>
					{teams.map((team) => (
						<Link
							key={team.id}
							href={appRoutes.teams.calendar(team.id)}
							className="flex items-center justify-between border-b px-0 py-3 text-sm hover:bg-muted/30 transition-colors"
						>
							<span className="font-medium">
								[{team.tag}] {team.name}
							</span>
							<span className="text-muted-foreground">View calendar →</span>
						</Link>
					))}
				</div>
			</div>
		</PageContainer>
	);
}
