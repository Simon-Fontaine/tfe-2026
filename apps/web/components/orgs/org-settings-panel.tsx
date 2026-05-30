"use client";

import { useState } from "react";
import {
	archiveOrgAction,
	cancelOrgOwnershipWorkflowAction,
	leaveOrgAction,
	resolveOrgOwnershipWorkflowAction,
	respondOrgOwnershipWorkflowAction,
	restoreOrgAction,
	transferOrgOwnershipAction,
} from "@/app/actions/org";
import { DeleteOrgDialog } from "@/components/orgs/delete-org-dialog";
import { OrgProfilePanel } from "@/components/orgs/org-profile-panel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { OrgWithTeams } from "@/lib/data/organization";

interface OrgSettingsPanelProps {
	org: OrgWithTeams;
	currentUserId: string;
	includeProfile?: boolean;
}

export function OrgSettingsPanel({
	org,
	currentUserId,
	includeProfile = true,
}: OrgSettingsPanelProps) {
	const leaveForm = useFormAction(leaveOrgAction, {
		loadingMessage: "Leaving organization…",
		successMessage: "You left the organization",
	});
	const transferForm = useFormAction(transferOrgOwnershipAction, {
		loadingMessage: "Starting transfer…",
		successMessage: "Ownership transfer requested",
	});
	const cancelOwnershipForm = useFormAction(cancelOrgOwnershipWorkflowAction, {
		loadingMessage: "Cancelling workflow…",
		successMessage: "Ownership workflow cancelled",
	});
	const respondOwnershipForm = useFormAction(respondOrgOwnershipWorkflowAction, {
		loadingMessage: "Updating workflow…",
		successMessage: "Ownership workflow updated",
	});
	const resolveOwnershipForm = useFormAction(resolveOrgOwnershipWorkflowAction, {
		loadingMessage: "Resolving recovery…",
		successMessage: "Ownership recovery resolved",
	});
	const archiveForm = useFormAction(archiveOrgAction, {
		loadingMessage: "Archiving organization…",
		successMessage: "Organization archived",
	});
	const restoreForm = useFormAction(restoreOrgAction, {
		loadingMessage: "Restoring organization…",
		successMessage: "Organization restored",
	});
	const [transferReason, setTransferReason] = useState("");
	const [lifecycleReason, setLifecycleReason] = useState("");

	function transferOwnership(memberId: string) {
		const fd = new FormData();
		fd.set("orgId", org.id);
		fd.set("memberId", memberId);
		fd.set("reason", transferReason);
		transferForm.submit(fd);
	}

	function cancelOwnershipWorkflow(workflowId: string) {
		const fd = new FormData();
		fd.set("orgId", org.id);
		fd.set("workflowId", workflowId);
		cancelOwnershipForm.submit(fd);
	}

	function respondOwnershipWorkflow(workflowId: string, action: "accept" | "reject") {
		const fd = new FormData();
		fd.set("orgId", org.id);
		fd.set("workflowId", workflowId);
		fd.set("action", action);
		respondOwnershipForm.submit(fd);
	}

	function resolveOwnershipWorkflow(workflowId: string, result: "approve" | "reject" | "block") {
		const fd = new FormData();
		fd.set("orgId", org.id);
		fd.set("workflowId", workflowId);
		fd.set("result", result);
		resolveOwnershipForm.submit(fd);
	}

	function leaveOrg() {
		const fd = new FormData();
		fd.set("orgId", org.id);
		leaveForm.submit(fd);
	}

	function submitLifecycleArchive() {
		const fd = new FormData();
		fd.set("orgId", org.id);
		fd.set("reason", lifecycleReason);
		archiveForm.submit(fd);
	}

	function submitLifecycleRestore() {
		const fd = new FormData();
		fd.set("orgId", org.id);
		fd.set("reason", lifecycleReason);
		restoreForm.submit(fd);
	}

	const ownershipCandidates = org.members.filter((member) => member.userId !== org.ownerId);
	const canRespondToOwnership =
		org.ownershipWorkflow?.kind === "transfer" &&
		org.ownershipWorkflow.status === "pending" &&
		org.ownershipWorkflow.recipient?.userId === currentUserId;
	const canResolveRecovery =
		org.ownershipWorkflow?.kind === "recovery" &&
		org.ownershipWorkflow.status === "review_required" &&
		org.currentUser.canManageSettings;

	return (
		<div className="space-y-6">
			{includeProfile ? <OrgProfilePanel org={org} title="Profile" /> : null}

			{org.currentUser.canTransferOwnership && (
				<section className="space-y-3">
					<div>
						<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Ownership
						</h2>
					</div>
					{org.ownershipWorkflow ? (
						<div className="space-y-2 border px-3 py-3">
							<div>
								<p className="text-xs font-medium capitalize">
									{org.ownershipWorkflow.kind} {org.ownershipWorkflow.status.replaceAll("_", " ")}
								</p>
								<p className="mt-1 text-[11px] text-muted-foreground">
									Recipient:{" "}
									{org.ownershipWorkflow.recipient?.displayName ??
										org.ownershipWorkflow.recoveryTarget?.displayName ??
										"Pending"}
								</p>
							</div>
							<p className="text-[11px] text-muted-foreground">
								Ownership-sensitive actions stay bound to the current owner until this workflow
								settles.
							</p>
							{canRespondToOwnership ? (
								<div className="flex flex-wrap gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											respondOwnershipWorkflow(org.ownershipWorkflow?.id ?? "unknown", "accept")
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
											respondOwnershipWorkflow(org.ownershipWorkflow?.id ?? "unknown", "reject")
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
											resolveOwnershipWorkflow(org.ownershipWorkflow?.id ?? "unknown", "approve")
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
											resolveOwnershipWorkflow(org.ownershipWorkflow?.id ?? "unknown", "reject")
										}
										disabled={resolveOwnershipForm.isPending}
									>
										Reject recovery
									</Button>
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											resolveOwnershipWorkflow(org.ownershipWorkflow?.id ?? "unknown", "block")
										}
										disabled={resolveOwnershipForm.isPending}
									>
										Block recovery
									</Button>
								</div>
							) : null}
							{org.currentUser.canTransferOwnership ? (
								<Button
									size="sm"
									variant="outline"
									onClick={() => cancelOwnershipWorkflow(org.ownershipWorkflow?.id ?? "unknown")}
									disabled={cancelOwnershipForm.isPending}
								>
									{cancelOwnershipForm.isPending && <Spinner className="mr-1.5" />}
									Cancel workflow
								</Button>
							) : null}
						</div>
					) : ownershipCandidates.length === 0 ? (
						<div className="border px-3 py-3">
							<p className="text-xs font-medium">No eligible transfer target</p>
							<p className="mt-1 text-[11px] text-muted-foreground">
								Invite another organization member before transferring ownership.
							</p>
						</div>
					) : (
						<div className="space-y-2">
							<textarea
								value={transferReason}
								onChange={(event) => setTransferReason(event.target.value)}
								maxLength={800}
								rows={2}
								className="min-h-16 w-full border bg-background px-3 py-2 text-sm"
								placeholder="Optional transfer note for audit history"
							/>
							{ownershipCandidates.map((member) => (
								<div key={member.id} className="flex items-center justify-between border px-3 py-2">
									<div>
										<p className="text-xs font-medium">{member.displayName}</p>
										<p className="text-[11px] text-muted-foreground capitalize">{member.role}</p>
									</div>
									<Button
										size="sm"
										variant="outline"
										onClick={() => transferOwnership(member.id)}
										disabled={transferForm.isPending}
									>
										{transferForm.isPending && <Spinner className="mr-1.5" />}
										Request transfer
									</Button>
								</div>
							))}
						</div>
					)}
				</section>
			)}

			<Separator />

			<section className="space-y-3">
				<div>
					<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Danger Zone
					</h2>
				</div>
				{org.lifecycleWorkflow ? (
					<div className="border px-3 py-3">
						<p className="text-xs font-medium capitalize">
							{/* P25: distinct label for irreversible state */}
							{org.lifecycleWorkflow.status === "irreversible"
								? "Irreversibly settled — no further actions available"
								: org.lifecycleWorkflow.status.replaceAll("_", " ")}
						</p>
						{org.lifecycleWorkflow.recoveryUntil ? (
							<p className="mt-1 text-[11px] text-muted-foreground">
								{/* P29: format ISO date as human-readable */}
								Recovery window until:{" "}
								{new Date(org.lifecycleWorkflow.recoveryUntil).toLocaleString()}
							</p>
						) : (
							<p className="mt-1 text-[11px] text-muted-foreground">
								Recovery window: not applicable
							</p>
						)}
					</div>
				) : null}
				{/* P32: explain to non-owners why delete is unavailable */}
				{!org.currentUser.canDelete && (
					<p className="text-[11px] text-muted-foreground">
						Archive and deletion actions are restricted to the organization owner.
					</p>
				)}
				{org.currentUser.canDelete && (
					<textarea
						value={lifecycleReason}
						onChange={(event) => setLifecycleReason(event.target.value)}
						maxLength={800}
						rows={2}
						className="min-h-16 w-full border bg-background px-3 py-2 text-sm"
						placeholder="Lifecycle reason for archive or restore history"
					/>
				)}
				<div className="flex flex-wrap gap-2">
					{org.currentUser.canLeave && (
						<Button size="sm" variant="outline" onClick={leaveOrg} disabled={leaveForm.isPending}>
							{leaveForm.isPending && <Spinner className="mr-1.5" />}
							Leave organization
						</Button>
					)}
					{/* P24: only show archive/restore for active or archived status */}
					{org.currentUser.canDelete &&
						(org.lifecycleStatus === "active" || org.lifecycleStatus === "archived") && (
							<Button
								size="sm"
								variant="outline"
								onClick={
									org.lifecycleStatus === "archived"
										? submitLifecycleRestore
										: submitLifecycleArchive
								}
								disabled={archiveForm.isPending || restoreForm.isPending}
							>
								{(archiveForm.isPending || restoreForm.isPending) && <Spinner className="mr-1.5" />}
								{org.lifecycleStatus === "archived"
									? "Restore organization"
									: "Archive organization"}
							</Button>
						)}
					{/* P24: only show delete when org is not irreversible */}
					{org.currentUser.canDelete && org.lifecycleStatus !== "irreversible" && (
						<DeleteOrgDialog orgId={org.id} orgName={org.name}>
							<Button size="sm" variant="destructive">
								Delete organization
							</Button>
						</DeleteOrgDialog>
					)}
				</div>
			</section>
		</div>
	);
}
