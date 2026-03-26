"use client";

import { useState } from "react";
import {
	leaveOrgAction,
	transferOrgOwnershipAction,
	updateOrgAction,
} from "@/app/dashboard/workspace/orgs/actions/org";
import { DeleteOrgDialog } from "@/components/orgs/delete-org-dialog";
import { EntityImageUploadField } from "@/components/shared/entity-image-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import type { OrgWithTeams } from "@/lib/data/organization";

interface OrgSettingsPanelProps {
	org: OrgWithTeams;
}

export function OrgSettingsPanel({ org }: OrgSettingsPanelProps) {
	const [name, setName] = useState(org.name);
	const [slug, setSlug] = useState(org.slug);
	const [description, setDescription] = useState(org.description ?? "");
	const [avatarUrl, setAvatarUrl] = useState(org.avatarUrl ?? "");
	const [bannerUrl, setBannerUrl] = useState(org.bannerUrl ?? "");

	const updateForm = useFormAction(updateOrgAction, {
		loadingMessage: "Saving org settings…",
		successMessage: "Organisation updated",
	});
	const leaveForm = useFormAction(leaveOrgAction, {
		loadingMessage: "Leaving organisation…",
		successMessage: "You left the organisation",
	});
	const transferForm = useFormAction(transferOrgOwnershipAction, {
		loadingMessage: "Transferring ownership…",
		successMessage: "Ownership transferred",
	});

	function submitSettings(e: React.FormEvent) {
		e.preventDefault();
		const fd = new FormData();
		fd.set("orgId", org.id);
		fd.set("name", name);
		fd.set("slug", slug);
		fd.set("description", description);
		fd.set("avatarUrl", avatarUrl);
		fd.set("bannerUrl", bannerUrl);
		updateForm.submit(fd);
	}

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
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Profile</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={submitSettings} className="space-y-4">
						<Field>
							<FieldLabel>Name</FieldLabel>
							<Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
						</Field>
						<Field>
							<FieldLabel>Slug</FieldLabel>
							<Input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={50} />
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
						<Field>
							<EntityImageUploadField
								label="Org avatar"
								kind="org-avatar"
								value={avatarUrl}
								onChange={setAvatarUrl}
								helperText="Square image recommended · max 2 MB"
							/>
						</Field>
						<Field>
							<EntityImageUploadField
								label="Org banner"
								kind="org-banner"
								value={bannerUrl}
								onChange={setBannerUrl}
								helperText="Wide image recommended · max 4 MB"
							/>
						</Field>
						<Button type="submit" size="sm" disabled={updateForm.isPending}>
							{updateForm.isPending && <Spinner className="mr-1.5" />}
							Save changes
						</Button>
					</form>
				</CardContent>
			</Card>

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
