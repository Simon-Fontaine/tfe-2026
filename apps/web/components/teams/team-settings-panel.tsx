"use client";

import { UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useState } from "react";
import {
	archiveTeamAction,
	deleteTeamAction,
	leaveTeamAction,
	unarchiveTeamAction,
	updateTeamAction,
} from "@/app/dashboard/workspace/orgs/actions/team";
import { EntityImageUploadField } from "@/components/shared/entity-image-upload-field";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
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
	const [name, setName] = useState(team.name);
	const [tag, setTag] = useState(team.tag);
	const [description, setDescription] = useState(team.description ?? "");
	const [avatarUrl, setAvatarUrl] = useState(team.avatarUrl ?? "");
	const [bannerUrl, setBannerUrl] = useState(team.bannerUrl ?? "");
	const updateForm = useFormAction(updateTeamAction, {
		loadingMessage: "Saving team settings…",
		successMessage: "Team updated",
	});
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

	function submitSettings(e: React.FormEvent) {
		e.preventDefault();
		const fd = new FormData();
		fd.set("teamId", team.id);
		fd.set("name", name);
		fd.set("tag", tag);
		fd.set("description", description);
		fd.set("avatarUrl", avatarUrl);
		fd.set("bannerUrl", bannerUrl);
		updateForm.submit(fd);
	}

	return (
		<div className="space-y-4">
			{canManageSettings && (
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Profile</CardTitle>
						<CardDescription>
							Update the team name, tag, description, and media from this settings page.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={submitSettings} className="flex flex-col gap-4">
							<FieldGroup>
								<Field>
									<FieldLabel>Name</FieldLabel>
									<Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
								</Field>
								<Field>
									<FieldLabel>Tag</FieldLabel>
									<Input
										value={tag}
										onChange={(e) => setTag(e.target.value.toUpperCase())}
										maxLength={5}
										className="font-mono uppercase"
									/>
									<FieldDescription>
										Used across roster, posts, and the public team profile.
									</FieldDescription>
								</Field>
								<Field>
									<FieldLabel>Description</FieldLabel>
									<Textarea
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										rows={4}
										maxLength={280}
									/>
								</Field>
								<EntityImageUploadField
									label="Team avatar"
									kind="team-avatar"
									value={avatarUrl}
									onChange={setAvatarUrl}
									helperText="Square image recommended · max 2 MB"
								/>
								<EntityImageUploadField
									label="Team banner"
									kind="team-banner"
									value={bannerUrl}
									onChange={setBannerUrl}
									helperText="Wide image recommended · max 4 MB"
								/>
							</FieldGroup>
							{updateForm.state?.error ? <FieldError>{updateForm.state.error}</FieldError> : null}
							<div className="flex flex-wrap items-center gap-2">
								<Button type="submit" size="sm" disabled={updateForm.isPending}>
									{updateForm.isPending && <Spinner className="mr-1.5" />}
									Save changes
								</Button>
								<p className="text-xs text-muted-foreground">
									Changes update both the workspace and public team profile.
								</p>
							</div>
						</form>
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
