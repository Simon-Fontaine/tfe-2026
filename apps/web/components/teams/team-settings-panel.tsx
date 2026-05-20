"use client";

import { useState } from "react";
import {
	archiveTeamAction,
	deleteTeamAction,
	leaveTeamAction,
	unarchiveTeamAction,
	updateTeamAction,
} from "@/app/actions/team";
import { EntityImageUploadField } from "@/components/shared/entity-image-upload-field";
import { RecruitingToggle } from "@/components/teams/recruiting-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import type { TeamWithRoster } from "@/lib/data/team";

interface TeamSettingsPanelProps {
	team: TeamWithRoster;
}

function getFieldErrorText(
	fieldErrors: Partial<Record<string, string[]>> | undefined,
	field: string
) {
	return fieldErrors?.[field]?.join(" ");
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
	const updateFieldErrors = updateForm.state?.fieldErrors;

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
									<FieldError>{getFieldErrorText(updateFieldErrors, "name")}</FieldError>
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
										Used across roster, recruiting listings, and the public team profile.
									</FieldDescription>
									<FieldError>{getFieldErrorText(updateFieldErrors, "tag")}</FieldError>
								</Field>
								<Field>
									<FieldLabel>Description</FieldLabel>
									<Textarea
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										rows={4}
										maxLength={280}
									/>
									<FieldError>{getFieldErrorText(updateFieldErrors, "description")}</FieldError>
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
