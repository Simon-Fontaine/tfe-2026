"use client";

import { useState } from "react";
import { updateOrgAction } from "@/app/actions/org";
import { EntityImageUploadField } from "@/components/shared/entity-image-upload-field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import type { OrgWithTeams } from "@/lib/data/organization";
import { cn } from "@/lib/utils";

interface OrgProfilePanelProps {
	org: OrgWithTeams;
	title?: string;
	description?: string;
}

export function OrgProfilePanel({
	org,
	title = "Brand profile",
	description = "Update your org identity, public slug, and media assets.",
}: OrgProfilePanelProps) {
	const [name, setName] = useState(org.name);
	const [slug, setSlug] = useState(org.slug);
	const [descriptionValue, setDescriptionValue] = useState(org.description ?? "");
	const [avatarUrl, setAvatarUrl] = useState(org.avatarUrl ?? "");
	const [bannerUrl, setBannerUrl] = useState(org.bannerUrl ?? "");

	const updateForm = useFormAction(updateOrgAction, {
		loadingMessage: "Saving org profile…",
		successMessage: "Organisation updated",
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
		updateForm.submit(fd);
	}

	const totalTeams = org.activeTeams.length + org.archivedTeams.length;
	const openListingCount = org.ownedListings.filter((post) => post.status === "open").length;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="overflow-hidden border">
					<div
						className={cn(
							"h-28 border-b bg-muted/40 bg-cover bg-center",
							!bannerUrl &&
								"bg-[radial-gradient(circle_at_top_right,_hsl(var(--primary)/0.22),_transparent_45%),linear-gradient(135deg,hsl(var(--muted)),hsl(var(--background)))]"
						)}
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
								{descriptionValue ||
									"Add a short description so players and staff understand the org."}
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
					</Field>
					<Field>
						<FieldLabel>Slug</FieldLabel>
						<Input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={50} />
					</Field>
					<Field>
						<FieldLabel>Description</FieldLabel>
						<Textarea
							value={descriptionValue}
							onChange={(e) => setDescriptionValue(e.target.value)}
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
	);
}
