"use client";

import { UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import {
	archiveTeamAction,
	deleteTeamAction,
	leaveTeamAction,
	unarchiveTeamAction,
} from "@/app/dashboard/workspace/orgs/actions/team";
import { EditTeamDialog } from "@/components/teams/edit-team-dialog";
import { RecruitingToggle } from "@/components/teams/recruiting-toggle";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { TeamWithRoster } from "@/lib/data/team";
import { dashboardRoutes } from "@/lib/routes";

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
						<CardAction>
							<EditTeamDialog
								teamId={team.id}
								initialValues={{
									name: team.name,
									tag: team.tag,
									description: team.description,
									avatarUrl: team.avatarUrl,
									bannerUrl: team.bannerUrl,
								}}
							>
								<Button size="sm">Edit profile</Button>
							</EditTeamDialog>
						</CardAction>
						<CardTitle className="text-sm">Profile</CardTitle>
						<CardDescription>
							Update the team name, tag, description, and media from this dedicated settings page.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						<div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
							<div className="border px-3 py-2">
								<p className="font-medium text-foreground">Name</p>
								<p>{team.name}</p>
							</div>
							<div className="border px-3 py-2">
								<p className="font-medium text-foreground">Tag</p>
								<p>{team.tag}</p>
							</div>
						</div>
						{team.description ? (
							<div className="border px-3 py-2">
								<p className="font-medium text-foreground">Description</p>
								<p className="text-muted-foreground">{team.description}</p>
							</div>
						) : (
							<p className="text-xs text-muted-foreground">No team description has been set yet.</p>
						)}
					</CardContent>
				</Card>
			)}

			{canManageSettings && (
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Recruiting</CardTitle>
						<CardDescription>
							Recruiting is a team setting. Change it here instead of from the team overview.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-wrap items-center justify-between gap-3">
						<div className="space-y-1">
							<p className="text-xs font-medium">Open roster visibility</p>
							<p className="text-xs text-muted-foreground">
								When enabled, this team can publish and advertise open roles.
							</p>
						</div>
						<RecruitingToggle teamId={team.id} isRecruiting={team.isRecruiting} />
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					{canManageSettings ? (
						<CardAction>
							<Button asChild size="sm">
								<Link href={dashboardRoutes.context.teamInvites(team.organizationId, team.id)}>
									<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="mr-1.5 size-4" />
									Manage invites
								</Link>
							</Button>
						</CardAction>
					) : null}
					<CardTitle className="text-sm">Membership policy</CardTitle>
					<CardDescription>
						New team members must be invited. Direct roster adds are disabled across players and
						staff.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2 text-xs text-muted-foreground">
					<p>Use team invites to bring in players, coaches, analysts, managers, and admins.</p>
					<p>
						Roster edits here only apply to existing members after they have accepted an invite.
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Danger Zone</CardTitle>
					<CardDescription>
						Archive, delete, or leave the team from here. These actions affect the full workspace.
					</CardDescription>
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
