"use client";

import { useEffect, useRef, useState } from "react";
import {
	archiveTeamAction,
	cancelTeamOwnershipWorkflowAction,
	deleteTeamAction,
	leaveTeamAction,
	requestTeamDeletionCodeAction,
	requestTeamOwnershipCodeAction,
	respondTeamOwnershipWorkflowAction,
	transferTeamOwnershipAction,
	unarchiveTeamAction,
	updateTeamAction,
} from "@/app/actions/team";
import { EntityImageUploadField } from "@/components/shared/entity-image-upload-field";
import { RecruitingToggle } from "@/components/teams/recruiting-toggle";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import type { TeamWithRoster } from "@/lib/data/team";

interface TeamSettingsPanelProps {
	team: TeamWithRoster;
	currentUserId: string;
}

function getFieldErrorText(
	fieldErrors: Partial<Record<string, string[]>> | undefined,
	field: string
) {
	return fieldErrors?.[field]?.join(" ");
}

export function TeamSettingsPanel({ team, currentUserId }: TeamSettingsPanelProps) {
	const canManageSettings = team.currentUser.canManageSettings;
	const canManageLifecycle =
		team.currentUser.orgRole === "owner" || team.currentUser.orgRole === "admin";
	const [name, setName] = useState(team.name);
	const [tag, setTag] = useState(team.tag);
	const [description, setDescription] = useState(team.description ?? "");
	const [avatarUrl, setAvatarUrl] = useState(team.avatarUrl ?? "");
	const [bannerUrl, setBannerUrl] = useState(team.bannerUrl ?? "");
	const [isPublic, setIsPublic] = useState(team.isPublic);
	const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
	const archivePendingRef = useRef(false);
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
		loadingMessage: "Requesting deletion…",
	});
	const deletionCodeForm = useFormAction(requestTeamDeletionCodeAction, {
		loadingMessage: "Sending code…",
		successMessage: "Verification code sent",
	});
	const leaveForm = useFormAction(leaveTeamAction, {
		loadingMessage: "Leaving team…",
		successMessage: "You left the team",
	});
	const transferForm = useFormAction(transferTeamOwnershipAction, {
		loadingMessage: "Starting transfer…",
		successMessage: "Ownership transfer requested",
	});
	const requestCodeForm = useFormAction(requestTeamOwnershipCodeAction, {
		loadingMessage: "Sending code…",
		successMessage: "Verification code sent to your email",
	});
	const cancelOwnershipForm = useFormAction(cancelTeamOwnershipWorkflowAction, {
		loadingMessage: "Cancelling workflow…",
		successMessage: "Ownership workflow cancelled",
	});
	const respondOwnershipForm = useFormAction(respondTeamOwnershipWorkflowAction, {
		loadingMessage: "Updating workflow…",
		successMessage: "Ownership workflow updated",
	});
	const [transferReason, setTransferReason] = useState("");
	const [selectedMemberId, setSelectedMemberId] = useState("");
	const [transferCode, setTransferCode] = useState("");
	const [lifecycleReason, setLifecycleReason] = useState("");
	const [deleteConfirmName, setDeleteConfirmName] = useState("");
	const [deleteVerificationCode, setDeleteVerificationCode] = useState("");
	const updateFieldErrors = updateForm.state?.fieldErrors;

	useEffect(() => {
		if ((archiveForm.state?.success || unarchiveForm.state?.success) && archivePendingRef.current) {
			archivePendingRef.current = false;
			setArchiveDialogOpen(false);
			setLifecycleReason("");
		}
	}, [archiveForm.state, unarchiveForm.state]);
	const canRespondToOwnership =
		team.ownershipWorkflow?.status === "pending" &&
		team.ownershipWorkflow.recipient?.userId === currentUserId;
	const transferCandidates = team.members.filter(
		(member) => member.status === "active" && member.userId !== currentUserId
	);
	const selectedMember = transferCandidates.find((member) => member.id === selectedMemberId);

	function submitArchive() {
		const fd = new FormData();
		fd.set("teamId", team.id);
		fd.set("reason", lifecycleReason);
		archiveForm.submit(fd);
	}

	function submitUnarchive() {
		const fd = new FormData();
		fd.set("teamId", team.id);
		fd.set("reason", lifecycleReason);
		unarchiveForm.submit(fd);
	}

	function submitDelete() {
		const fd = new FormData();
		fd.set("teamId", team.id);
		fd.set("confirmName", deleteConfirmName);
		fd.set("reason", lifecycleReason);
		fd.set("verificationCode", deleteVerificationCode);
		deleteForm.submit(fd);
	}

	function requestDeletionCode() {
		const fd = new FormData();
		fd.set("teamId", team.id);
		deletionCodeForm.submit(fd);
	}

	function submitLeave() {
		const fd = new FormData();
		fd.set("teamId", team.id);
		leaveForm.submit(fd);
	}

	function sendTransferCode(memberId: string) {
		const fd = new FormData();
		fd.set("teamId", team.id);
		fd.set("memberId", memberId);
		requestCodeForm.submit(fd);
	}

	function transferOwnership(memberId: string) {
		const fd = new FormData();
		fd.set("teamId", team.id);
		fd.set("memberId", memberId);
		fd.set("verificationCode", transferCode.trim());
		fd.set("reason", transferReason);
		transferForm.submit(fd);
	}

	function cancelOwnershipWorkflow(workflowId: string) {
		const fd = new FormData();
		fd.set("teamId", team.id);
		fd.set("workflowId", workflowId);
		cancelOwnershipForm.submit(fd);
	}

	function respondOwnershipWorkflow(workflowId: string, action: "accept" | "reject") {
		const fd = new FormData();
		fd.set("teamId", team.id);
		fd.set("workflowId", workflowId);
		fd.set("action", action);
		respondOwnershipForm.submit(fd);
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
		fd.set("isPublic", isPublic ? "true" : "false");
		updateForm.submit(fd);
	}

	return (
		<div className="space-y-6">
			{canManageSettings && (
				<section>
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Profile
					</p>
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
							<Field orientation="horizontal" className="justify-between border p-3">
								<div className="space-y-1">
									<FieldLabel htmlFor="team-public">Public profile</FieldLabel>
									<FieldDescription>
										Show this team on public team and organization discovery surfaces.
									</FieldDescription>
								</div>
								<Switch id="team-public" checked={isPublic} onCheckedChange={setIsPublic} />
							</Field>
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
				</section>
			)}

			{canManageSettings && (
				<>
					<Separator />
					<section>
						<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Recruiting
						</p>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="space-y-1">
								<p className="text-xs font-medium">Open roster visibility</p>
								<p className="text-xs text-muted-foreground">
									When enabled, this team can publish and advertise open roles.
								</p>
							</div>
							<RecruitingToggle teamId={team.id} isRecruiting={team.isRecruiting} />
						</div>
					</section>
				</>
			)}

			{canManageSettings && (
				<>
					<Separator />
					<section>
						<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Ownership
						</p>
						<div className="space-y-3">
							{team.ownershipWorkflow ? (
								<div className="space-y-2 border px-3 py-3">
									<p className="text-xs font-medium">
										Ownership transfer {team.ownershipWorkflow.status}
									</p>
									<p className="text-[11px] text-muted-foreground">
										Recipient: {team.ownershipWorkflow.recipient?.displayName ?? "Pending"}
									</p>
									<p className="text-[11px] text-muted-foreground">
										The recipient becomes the team manager once they accept.
									</p>
									{canRespondToOwnership ? (
										<div className="flex flex-wrap gap-2">
											<Button
												size="sm"
												variant="outline"
												onClick={() =>
													respondOwnershipWorkflow(
														team.ownershipWorkflow?.id ?? "unknown",
														"accept"
													)
												}
												disabled={respondOwnershipForm.isPending}
											>
												{respondOwnershipForm.isPending && <Spinner className="mr-1.5" />}
												Accept transfer
											</Button>
											<Button
												size="sm"
												variant="outline"
												onClick={() =>
													respondOwnershipWorkflow(
														team.ownershipWorkflow?.id ?? "unknown",
														"reject"
													)
												}
												disabled={respondOwnershipForm.isPending}
											>
												Reject transfer
											</Button>
										</div>
									) : null}
									{canManageSettings && (
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												cancelOwnershipWorkflow(team.ownershipWorkflow?.id ?? "unknown")
											}
											disabled={cancelOwnershipForm.isPending}
										>
											{cancelOwnershipForm.isPending && <Spinner className="mr-1.5" />}
											Cancel workflow
										</Button>
									)}
								</div>
							) : transferCandidates.length === 0 ? (
								<div className="border px-3 py-3">
									<p className="text-xs font-medium">No eligible transfer target</p>
									<p className="mt-1 text-[11px] text-muted-foreground">
										Add another active team member before transferring ownership.
									</p>
								</div>
							) : (
								<div className="space-y-3">
									<p className="text-[11px] text-muted-foreground">
										Choose a member, send a verification code to your email, then confirm. The new
										manager must accept before the transfer completes.
									</p>
									<div className="space-y-1">
										{transferCandidates.map((member) => (
											<button
												key={member.id}
												type="button"
												onClick={() => setSelectedMemberId(member.id)}
												className={`flex w-full items-center justify-between border px-3 py-2 text-left ${
													selectedMemberId === member.id ? "border-primary" : ""
												}`}
											>
												<div>
													<p className="text-xs font-medium">{member.displayName}</p>
													<p className="text-[11px] text-muted-foreground capitalize">
														{member.permissionRole}
													</p>
												</div>
												{selectedMemberId === member.id ? (
													<span className="text-[11px] font-medium text-primary">Selected</span>
												) : null}
											</button>
										))}
									</div>
									{selectedMember ? (
										<div className="space-y-2 border px-3 py-3">
											<p className="text-xs font-medium">
												Transfer to {selectedMember.displayName}
											</p>
											<div className="flex flex-wrap gap-2">
												<input
													value={transferCode}
													onChange={(event) => setTransferCode(event.target.value)}
													className="h-9 min-w-52 flex-1 border bg-background px-3 text-xs"
													placeholder="Verification code"
												/>
												<Button
													size="sm"
													variant="outline"
													onClick={() => sendTransferCode(selectedMember.id)}
													disabled={requestCodeForm.isPending}
												>
													{requestCodeForm.isPending && <Spinner className="mr-1.5" />}
													Send code
												</Button>
											</div>
											<textarea
												value={transferReason}
												onChange={(event) => setTransferReason(event.target.value)}
												maxLength={800}
												rows={2}
												className="min-h-16 w-full border bg-background px-3 py-2 text-xs"
												placeholder="Optional transfer note for audit history"
											/>
											<Button
												size="sm"
												variant="outline"
												onClick={() => transferOwnership(selectedMember.id)}
												disabled={transferForm.isPending || transferCode.trim().length === 0}
											>
												{transferForm.isPending && <Spinner className="mr-1.5" />}
												Confirm transfer
											</Button>
										</div>
									) : null}
								</div>
							)}
						</div>
					</section>
				</>
			)}

			<Separator />
			<section>
				<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Danger Zone
				</p>
				<div className="flex flex-wrap gap-2">
					<div className="basis-full space-y-2">
						{team.lifecycleWorkflow ? (
							<div className="border px-3 py-3">
								<p className="text-xs font-medium capitalize">
									{team.lifecycleWorkflow.status === "irreversible"
										? "Irreversibly settled — no further actions available"
										: team.lifecycleWorkflow.status.replaceAll("_", " ")}
								</p>
								{team.lifecycleWorkflow.recoveryUntil ? (
									<p className="mt-1 text-[11px] text-muted-foreground">
										Recovery window until:{" "}
										{new Date(team.lifecycleWorkflow.recoveryUntil).toLocaleString()}
									</p>
								) : (
									<p className="mt-1 text-[11px] text-muted-foreground">
										Recovery window: not applicable
									</p>
								)}
							</div>
						) : null}
						{canManageLifecycle ? (
							<>
								<textarea
									value={lifecycleReason}
									onChange={(event) => setLifecycleReason(event.target.value)}
									maxLength={800}
									rows={2}
									className="min-h-16 w-full border bg-background px-3 py-2 text-xs"
									placeholder="Reason for archive, restore, or deletion"
								/>
								<input
									value={deleteConfirmName}
									onChange={(event) => setDeleteConfirmName(event.target.value)}
									className="h-9 w-full border bg-background px-3 text-xs"
									placeholder={`Type ${team.name} before deletion-pending`}
								/>
								<div className="flex flex-wrap gap-2">
									<input
										value={deleteVerificationCode}
										onChange={(event) => setDeleteVerificationCode(event.target.value)}
										className="h-9 min-w-52 flex-1 border bg-background px-3 text-xs"
										placeholder="Verification code"
									/>
									<Button
										size="sm"
										variant="outline"
										onClick={requestDeletionCode}
										disabled={deletionCodeForm.isPending}
									>
										{deletionCodeForm.isPending && <Spinner className="mr-1.5" />}
										Send code
									</Button>
								</div>
							</>
						) : (
							<p className="text-[11px] text-muted-foreground">
								Archive and deletion actions are restricted to organization owners and admins.
							</p>
						)}
					</div>
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
					{canManageLifecycle &&
						(team.lifecycleStatus === "active" || team.lifecycleStatus === "archived") && (
							<Button size="sm" variant="outline" onClick={() => setArchiveDialogOpen(true)}>
								{team.isArchived ? "Restore team" : "Archive team"}
							</Button>
						)}
					{canManageLifecycle && team.lifecycleStatus !== "irreversible" && (
						<Button
							size="sm"
							variant="outline"
							className="border-destructive text-destructive hover:bg-destructive/10"
							onClick={submitDelete}
							disabled={
								deleteForm.isPending ||
								deleteConfirmName !== team.name ||
								deleteVerificationCode.trim().length === 0
							}
						>
							{deleteForm.isPending && <Spinner className="mr-1.5" />}
							Request deletion
						</Button>
					)}
				</div>
			</section>

			<Dialog
				open={archiveDialogOpen}
				onOpenChange={(open) => {
					if (!open) setLifecycleReason("");
					setArchiveDialogOpen(open);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{team.isArchived ? "Restore team?" : "Archive team?"}</DialogTitle>
						<DialogDescription>
							{team.isArchived
								? "This will restore the team to active status."
								: "This will archive the team and suspend active recruiting."}
						</DialogDescription>
					</DialogHeader>
					<textarea
						value={lifecycleReason}
						onChange={(event) => setLifecycleReason(event.target.value)}
						maxLength={800}
						rows={2}
						className="min-h-16 w-full border bg-background px-3 py-2 text-xs"
						placeholder="Reason for archive or restore"
					/>
					{(archiveForm.state?.error || unarchiveForm.state?.error) && (
						<p className="text-sm text-destructive">
							{archiveForm.state?.error ?? unarchiveForm.state?.error}
						</p>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => {
								archivePendingRef.current = true;
								team.isArchived ? submitUnarchive() : submitArchive();
							}}
							disabled={archiveForm.isPending || unarchiveForm.isPending}
						>
							{(archiveForm.isPending || unarchiveForm.isPending) && <Spinner className="mr-1.5" />}
							{team.isArchived ? "Restore team" : "Archive team"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
