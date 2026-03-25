"use client";

import {
	archiveTeamAction,
	deleteTeamAction,
	leaveTeamAction,
	unarchiveTeamAction,
} from "@/app/dashboard/workspace/orgs/actions/team";
import { EditTeamDialog } from "@/components/teams/edit-team-dialog";
import { RecruitingToggle } from "@/components/teams/recruiting-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { TeamWithRoster } from "@/lib/data/team";

interface TeamSettingsPanelProps {
	team: TeamWithRoster;
}

export function TeamSettingsPanel({ team }: TeamSettingsPanelProps) {
	const canManageSettings = team.currentUser.canManageSettings;
	const canManageLifecycle =
		team.currentUser.orgRole === "owner" || team.currentUser.orgRole === "admin";
	const archiveForm = useFormAction(archiveTeamAction, {
		loadingMessage: "Archiving team…",
		successMessage: "Team archived",
	});
	const unarchiveForm = useFormAction(unarchiveTeamAction, {
		loadingMessage: "Restoring team…",
		successMessage: "Team restored",
	});
	const deleteForm = useFormAction(deleteTeamAction, {
		loadingMessage: "Deleting team…",
	});
	const leaveForm = useFormAction(leaveTeamAction, {
		loadingMessage: "Leaving team…",
		successMessage: "You left the team",
	});

	function submitArchive() {
		const fd = new FormData();
		fd.set("teamId", team.id);
		archiveForm.submit(fd);
	}

	function submitUnarchive() {
		const fd = new FormData();
		fd.set("teamId", team.id);
		unarchiveForm.submit(fd);
	}

	function submitDelete() {
		const fd = new FormData();
		fd.set("teamId", team.id);
		deleteForm.submit(fd);
	}

	function submitLeave() {
		const fd = new FormData();
		fd.set("teamId", team.id);
		leaveForm.submit(fd);
	}

	return (
		<div className="space-y-4">
			{canManageSettings && (
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Team Settings</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-wrap items-center gap-3">
						<EditTeamDialog
							teamId={team.id}
							initialValues={{
								name: team.name,
								tag: team.tag,
								description: team.description,
								avatarUrl: team.avatarUrl,
							}}
						>
							<Button size="sm" variant="outline">
								Edit team profile
							</Button>
						</EditTeamDialog>
						<RecruitingToggle teamId={team.id} isRecruiting={team.isRecruiting} />
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Danger Zone</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					{team.currentUser.canLeave && (
						<Button
							size="sm"
							variant="outline"
							onClick={submitLeave}
							disabled={leaveForm.isPending}
						>
							{leaveForm.isPending && <Spinner className="mr-1.5" />}
							Leave team
						</Button>
					)}
					{canManageLifecycle ? (
						<Button
							size="sm"
							variant="outline"
							onClick={team.isArchived ? submitUnarchive : submitArchive}
							disabled={archiveForm.isPending || unarchiveForm.isPending}
						>
							{(archiveForm.isPending || unarchiveForm.isPending) && <Spinner className="mr-1.5" />}
							{team.isArchived ? "Restore team" : "Archive team"}
						</Button>
					) : null}
					{canManageLifecycle ? (
						<Button
							size="sm"
							variant="destructive"
							onClick={submitDelete}
							disabled={deleteForm.isPending}
						>
							{deleteForm.isPending && <Spinner className="mr-1.5" />}
							Delete team
						</Button>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
