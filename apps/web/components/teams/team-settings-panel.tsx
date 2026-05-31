"use client";

import { useEffect, useRef, useState } from "react";
import {
	archiveTeamAction,
	cancelTeamOwnershipWorkflowAction,
	deleteTeamAction,
	leaveTeamAction,
	requestTeamDeletionCodeAction,
	resolveTeamOwnershipWorkflowAction,
	respondTeamOwnershipWorkflowAction,
	startTeamOwnershipRecoveryAction,
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
	const recoveryForm = useFormAction(startTeamOwnershipRecoveryAction, {
		loadingMessage: "Starting recovery…",
		successMessage: "Recovery workflow started",
	});
	const cancelOwnershipForm = useFormAction(cancelTeamOwnershipWorkflowAction, {
		loadingMessage: "Cancelling workflow…",
		successMessage: "Ownership workflow cancelled",
	});
	const respondOwnershipForm = useFormAction(respondTeamOwnershipWorkflowAction, {
		loadingMessage: "Updating workflow…",
		successMessage: "Ownership workflow updated",
	});
	const resolveOwnershipForm = useFormAction(resolveTeamOwnershipWorkflowAction, {
		loadingMessage: "Resolving recovery…",
		successMessage: "Ownership recovery resolved",
	});
	const [recoveryReason, setRecoveryReason] = useState("");
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
		team.ownershipWorkflow?.kind === "transfer" &&
		team.ownershipWorkflow.status === "pending" &&
		team.ownershipWorkflow.recipient?.userId === currentUserId;
	const canResolveRecovery =
		team.ownershipWorkflow?.kind === "recovery" &&
		team.ownershipWorkflow.status === "review_required" &&
		canManageLifecycle;

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

	function submitRecovery() {
		const fd = new FormData();
		fd.set("teamId", team.id);
		fd.set("reason", recoveryReason);
		recoveryForm.submit(fd);
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

	function resolveOwnershipWorkflow(workflowId: string, result: "approve" | "reject" | "block") {
		const fd = new FormData();
		fd.set("teamId", team.id);
		fd.set("workflowId", workflowId);
		fd.set("result", result);
		resolveOwnershipForm.submit(fd);
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
									<p className="text-xs font-medium capitalize">
										{team.ownershipWorkflow.kind}{" "}
										{team.ownershipWorkflow.status.replaceAll("_", " ")}
									</p>
									<p className="text-[11px] text-muted-foreground">
										Review state: {team.ownershipWorkflow.reviewState.replaceAll("_", " ")}
									</p>
									<p className="text-[11px] text-muted-foreground">
										Ownership-sensitive actions reconcile against current team admins until the
										workflow settles.
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
									{canResolveRecovery ? (
										<div className="flex flex-wrap gap-2">
											<Button
												size="sm"
												variant="outline"
												onClick={() =>
													resolveOwnershipWorkflow(
														team.ownershipWorkflow?.id ?? "unknown",
														"approve"
													)
												}
												disabled={resolveOwnershipForm.isPending}
											>
												{resolveOwnershipForm.isPending && <Spinner className="mr-1.5" />}
												Approve recovery
											</Button>
											<Button
												size="sm"
												variant="outline"
												onClick={() =>
													resolveOwnershipWorkflow(
														team.ownershipWorkflow?.id ?? "unknown",
														"reject"
													)
												}
												disabled={resolveOwnershipForm.isPending}
											>
												Reject recovery
											</Button>
											<Button
												size="sm"
												variant="outline"
												onClick={() =>
													resolveOwnershipWorkflow(team.ownershipWorkflow?.id ?? "unknown", "block")
												}
												disabled={resolveOwnershipForm.isPending}
											>
												Block recovery
											</Button>
										</div>
									) : null}
									{/* P28: cancel button must be guarded — only team admins/managers should cancel */}
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
							) : (
								<div className="space-y-3">
									<div className="border px-3 py-3">
										<p className="text-xs font-medium">
											{team.adminCount > 0 ? "Admin continuity healthy" : "No active admin"}
										</p>
										<p className="mt-1 text-[11px] text-muted-foreground">
											{team.adminCount > 0
												? "At least one active team admin or org-authorized operator can manage this workspace."
												: "Start a reviewed recovery workflow before routine ownership-sensitive changes."}
										</p>
									</div>
									<textarea
										value={recoveryReason}
										onChange={(event) => setRecoveryReason(event.target.value)}
										maxLength={800}
										rows={2}
										className="min-h-16 w-full border bg-background px-3 py-2 text-xs"
										placeholder="Recovery reason and authority context"
									/>
									<Button
										size="sm"
										variant="outline"
										onClick={submitRecovery}
										disabled={recoveryForm.isPending || recoveryReason.trim().length === 0}
									>
										{recoveryForm.isPending && <Spinner className="mr-1.5" />}
										Start recovery review
									</Button>
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
									{/* P25: distinct label for irreversible state */}
									{team.lifecycleWorkflow.status === "irreversible"
										? "Irreversibly settled — no further actions available"
										: team.lifecycleWorkflow.status.replaceAll("_", " ")}
								</p>
								{team.lifecycleWorkflow.recoveryUntil ? (
									<p className="mt-1 text-[11px] text-muted-foreground">
										{/* P29: format ISO date as human-readable */}
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
					{/* P24: only show archive/restore for active or archived lifecycle state */}
					{canManageLifecycle &&
						(team.lifecycleStatus === "active" || team.lifecycleStatus === "archived") && (
							<Button size="sm" variant="outline" onClick={() => setArchiveDialogOpen(true)}>
								{team.isArchived ? "Restore team" : "Archive team"}
							</Button>
						)}
					{/* P24: only show delete when team is not irreversibly settled */}
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
