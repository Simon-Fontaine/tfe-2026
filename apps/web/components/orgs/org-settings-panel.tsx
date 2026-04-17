"use client";

import { leaveOrgAction, transferOrgOwnershipAction } from "@/app/actions/org";
import { DeleteOrgDialog } from "@/components/orgs/delete-org-dialog";
import { OrgProfilePanel } from "@/components/orgs/org-profile-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { OrgWithTeams } from "@/lib/data/organization";

interface OrgSettingsPanelProps {
	org: OrgWithTeams;
	includeProfile?: boolean;
}

export function OrgSettingsPanel({ org, includeProfile = true }: OrgSettingsPanelProps) {
	const leaveForm = useFormAction(leaveOrgAction, {
		loadingMessage: "Leaving organisation…",
		successMessage: "You left the organisation",
	});
	const transferForm = useFormAction(transferOrgOwnershipAction, {
		loadingMessage: "Transferring ownership…",
		successMessage: "Ownership transferred",
	});

	function transferOwnership(memberId: string) {
		const fd = new FormData();
		fd.set("orgId", org.id);
		fd.set("memberId", memberId);
		transferForm.submit(fd);
	}

	function leaveOrg() {
		const fd = new FormData();
		fd.set("orgId", org.id);
		leaveForm.submit(fd);
	}

	return (
		<div className="space-y-4">
			{includeProfile ? (
				<OrgProfilePanel
					org={org}
					title="Profile"
					description="Manage the organisation profile, slug, and media assets."
				/>
			) : null}

			{org.currentUser.canTransferOwnership && (
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Ownership</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-xs text-muted-foreground">
							Transfer ownership to another member before leaving if needed.
						</p>
						<div className="space-y-2">
							{org.members
								.filter((member) => member.userId !== org.ownerId)
								.map((member) => (
									<div
										key={member.id}
										className="flex items-center justify-between border px-3 py-2"
									>
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
											Make owner
										</Button>
									</div>
								))}
						</div>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Danger Zone</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					{org.currentUser.canLeave && (
						<Button size="sm" variant="outline" onClick={leaveOrg} disabled={leaveForm.isPending}>
							{leaveForm.isPending && <Spinner className="mr-1.5" />}
							Leave organisation
						</Button>
					)}
					{org.currentUser.canDelete && (
						<DeleteOrgDialog orgId={org.id} orgName={org.name}>
							<Button size="sm" variant="destructive">
								Delete organisation
							</Button>
						</DeleteOrgDialog>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
