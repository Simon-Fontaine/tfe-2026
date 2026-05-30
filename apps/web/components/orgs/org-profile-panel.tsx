"use client";

import { useState } from "react";
import { updateOrgAction } from "@/app/actions/org";
import { EntityImageUploadField } from "@/components/shared/entity-image-upload-field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import type { OrgWithTeams } from "@/lib/data/organization";

interface OrgProfilePanelProps {
	org: OrgWithTeams;
	title?: string;
}

export function OrgProfilePanel({ org, title = "Brand profile" }: OrgProfilePanelProps) {
	const [name, setName] = useState(org.name);
	const [slug, setSlug] = useState(org.slug);
	const [descriptionValue, setDescriptionValue] = useState(org.description ?? "");
	const [avatarUrl, setAvatarUrl] = useState(org.avatarUrl ?? "");
	const [bannerUrl, setBannerUrl] = useState(org.bannerUrl ?? "");
	const [website, setWebsite] = useState(org.website ?? "");
	const [discord, setDiscord] = useState(org.discord ?? "");
	const [twitter, setTwitter] = useState(org.twitter ?? "");
	const [isPublic, setIsPublic] = useState(org.isPublic);

	const updateForm = useFormAction(updateOrgAction, {
		loadingMessage: "Saving org profile…",
		successMessage: "Organization updated",
	});

	function submitSettings(e: React.FormEvent) {
		e.preventDefault();
		const fd = new FormData();
		fd.set("orgId", org.id);
		fd.set("name", name);
		fd.set("slug", slug);
		fd.set("description", descriptionValue);
		fd.set("avatarUrl", avatarUrl);
		fd.set("bannerUrl", bannerUrl);
		fd.set("website", website);
		fd.set("discord", discord);
		fd.set("twitter", twitter);
		fd.set("isPublic", isPublic ? "true" : "false");
		updateForm.submit(fd);
	}

	const totalTeams = org.activeTeams.length + org.archivedTeams.length;
	const openListingCount = org.ownedListings.filter((post) => post.status === "open").length;

	return (
		<section className="space-y-6 border p-6">
			<h2 className="mb-4 border-b pb-2 text-lg font-semibold">{title}</h2>
			<div className="space-y-4">
				<div className="overflow-hidden border">
					<div
						className="h-28 border-b bg-muted bg-cover bg-center"
						style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
					/>
					<div className="flex flex-wrap items-end gap-4 px-4 pb-4">
						<Avatar className="-mt-8 size-16 overflow-hidden rounded-none border-4 border-background after:rounded-none">
							<AvatarImage src={avatarUrl || undefined} className="rounded-none" />
							<AvatarFallback className="rounded-none text-sm font-bold">
								{name.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1 pt-3">
							<p className="truncate text-sm font-semibold">{name || "Organization name"}</p>
							<p className="text-xs text-muted-foreground">/{slug || "organization-slug"}</p>
							<p className="mt-2 text-xs text-muted-foreground">
								{descriptionValue || "No description"}
							</p>
						</div>
						<div className="grid gap-1 text-right text-[11px] text-muted-foreground">
							<p>{totalTeams} teams</p>
							<p>{org.members.length} members</p>
							<p>{openListingCount} open listings</p>
						</div>
					</div>
				</div>

				<form onSubmit={submitSettings} className="space-y-4">
					<Field>
						<FieldLabel>Name</FieldLabel>
						<Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
						<FieldError
							errors={updateForm.state?.fieldErrors?.name?.map((message) => ({ message }))}
						/>
						<FieldDescription>
							Shown in app workspaces and public organization pages.
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel>Slug</FieldLabel>
						<Input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={50} />
						<FieldError
							errors={updateForm.state?.fieldErrors?.slug?.map((message) => ({ message }))}
						/>
						<FieldDescription>
							Used for the public organization URL and workspace identity.
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel>Description</FieldLabel>
						<Textarea
							value={descriptionValue}
							onChange={(e) => setDescriptionValue(e.target.value)}
							rows={4}
							maxLength={280}
						/>
						<FieldError
							errors={updateForm.state?.fieldErrors?.description?.map((message) => ({
								message,
							}))}
						/>
						<FieldDescription>
							Keep this short enough to scan in public discovery cards.
						</FieldDescription>
					</Field>
					<Field>
						<EntityImageUploadField
							label="Org avatar"
							kind="org-avatar"
							value={avatarUrl}
							onChange={setAvatarUrl}
							helperText="Square image recommended · max 2 MB"
						/>
						<FieldError
							errors={updateForm.state?.fieldErrors?.avatarUrl?.map((message) => ({ message }))}
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
						<FieldError
							errors={updateForm.state?.fieldErrors?.bannerUrl?.map((message) => ({ message }))}
						/>
					</Field>
					<div className="grid gap-3 md:grid-cols-3">
						<Field>
							<FieldLabel>Website</FieldLabel>
							<Input
								value={website}
								onChange={(e) => setWebsite(e.target.value)}
								placeholder="https://example.com"
								maxLength={500}
							/>
							<FieldError
								errors={updateForm.state?.fieldErrors?.website?.map((message) => ({
									message,
								}))}
							/>
						</Field>
						<Field>
							<FieldLabel>Discord</FieldLabel>
							<Input
								value={discord}
								onChange={(e) => setDiscord(e.target.value)}
								placeholder="https://discord.gg/example"
								maxLength={100}
							/>
							<FieldError
								errors={updateForm.state?.fieldErrors?.discord?.map((message) => ({
									message,
								}))}
							/>
						</Field>
						<Field>
							<FieldLabel>X / Twitter</FieldLabel>
							<Input
								value={twitter}
								onChange={(e) => setTwitter(e.target.value)}
								placeholder="https://x.com/example"
								maxLength={100}
							/>
							<FieldError
								errors={updateForm.state?.fieldErrors?.twitter?.map((message) => ({
									message,
								}))}
							/>
						</Field>
					</div>
					<Field orientation="horizontal" className="justify-between rounded-md border p-3">
						<div className="space-y-1">
							<FieldLabel htmlFor="org-public">Public profile</FieldLabel>
							<FieldDescription>
								Show this organization on public org, recruiting, and team discovery surfaces.
							</FieldDescription>
						</div>
						<Switch id="org-public" checked={isPublic} onCheckedChange={setIsPublic} />
					</Field>
					<Button type="submit" size="sm" disabled={updateForm.isPending}>
						{updateForm.isPending && <Spinner className="mr-1.5" />}
						Save changes
					</Button>
				</form>
			</div>
		</section>
	);
}
