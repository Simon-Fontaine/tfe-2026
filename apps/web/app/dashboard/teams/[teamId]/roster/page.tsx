import Link from "next/link";

import TeamPlayersPage from "@/app/dashboard/teams/[teamId]/roster/players-panel";
import TeamStaffPage from "@/app/dashboard/teams/[teamId]/roster/staff-panel";
import { Badge } from "@/components/ui/badge";

export default async function TeamRosterPage({
	searchParams,
	params,
}: {
	searchParams: Promise<{ type?: string }>;
	params: Promise<{ teamId: string }>;
}) {
	const [{ type }, { teamId }] = await Promise.all([searchParams, params]);
	const activeTab = type === "staff" ? "staff" : "players";

	return (
		<div className="space-y-2">
			<div className="flex gap-2 px-4 pt-4">
				<Link href={`/dashboard/teams/${teamId}/roster?type=players`}>
					<Badge variant={activeTab === "players" ? "default" : "outline"}>Players</Badge>
				</Link>
				<Link href={`/dashboard/teams/${teamId}/roster?type=staff`}>
					<Badge variant={activeTab === "staff" ? "default" : "outline"}>Staff</Badge>
				</Link>
			</div>
			{activeTab === "staff" ? (
				<TeamStaffPage params={Promise.resolve({ teamId })} />
			) : (
				<TeamPlayersPage params={Promise.resolve({ teamId })} />
			)}
		</div>
	);
}
