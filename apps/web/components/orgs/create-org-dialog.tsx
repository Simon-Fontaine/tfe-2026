"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { appRoutes, type CreateOrgInput, CreateOrgSchema } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { createOrgAction } from "@/app/actions/org";
import { EntityImageUploadField } from "@/components/shared/entity-image-upload-field";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";

interface CreateOrgDialogProps {
	children: React.ReactNode;
}

export function CreateOrgDialog({ children }: CreateOrgDialogProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const pendingRef = useRef(false);

	const { state, submit, isPending } = useFormAction(createOrgAction, {
		loadingMessage: "Creating organization…",
		successMessage: "Organization created",
	});

	const form = useForm<CreateOrgInput>({
		resolver: valibotResolver(CreateOrgSchema),
		defaultValues: {
			name: "",
			slug: "",
			description: "",
			avatarUrl: "",
			bannerUrl: "",
			website: "",
			discord: "",
			twitter: "",
			isPublic: true,
		},
	});

	// Close dialog and navigate to new org on success.
	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setOpen(false);
			const orgId = (state as { orgId?: string }).orgId;
			if (orgId) router.push(appRoutes.orgs.byId(orgId));
		}
	}, [state, router]);

	useEffect(() => {
		if (!state?.fieldErrors) return;
		for (const [field, messages] of Object.entries(state.fieldErrors)) {
			const message = messages?.[0];
			if (!message) continue;
			form.setError(field as keyof CreateOrgInput, { message });
		}
	}, [state, form]);

	function onSubmit(values: CreateOrgInput) {
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("name", values.name);
		if (values.slug) fd.set("slug", values.slug);
		if (values.description) fd.set("description", values.description);
		if (values.avatarUrl) fd.set("avatarUrl", values.avatarUrl);
		if (values.bannerUrl) fd.set("bannerUrl", values.bannerUrl);
		if (values.website) fd.set("website", values.website);
		if (values.discord) fd.set("discord", values.discord);
		if (values.twitter) fd.set("twitter", values.twitter);
		fd.set("isPublic", values.isPublic === false ? "false" : "true");
		submit(fd);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(open) => {
				setOpen(open);
				if (open) form.reset();
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create organization</DialogTitle>
				</DialogHeader>

				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<Field>
						<FieldLabel htmlFor="org-name">Organization name</FieldLabel>
						<Input
							id="org-name"
							placeholder="e.g. Team Liquid"
							maxLength={50}
							{...form.register("name")}
						/>
						<FieldError errors={[form.formState.errors.name]} />
					</Field>

					<Field>
						<FieldLabel htmlFor="org-slug">
							Public slug <span className="font-normal text-muted-foreground/70">(optional)</span>
						</FieldLabel>
						<Input
							id="org-slug"
							placeholder="e.g. team-liquid"
							maxLength={50}
							{...form.register("slug", {
								setValueAs: (value) => (value === "" ? undefined : value),
							})}
						/>
						<FieldError errors={[form.formState.errors.slug]} />
					</Field>

					<Field>
						<FieldLabel htmlFor="org-description">
							Description <span className="font-normal text-muted-foreground/70">(optional)</span>
						</FieldLabel>
						<Textarea
							id="org-description"
							placeholder="A short description of your organization"
							maxLength={280}
							rows={3}
							{...form.register("description")}
						/>
						<FieldError errors={[form.formState.errors.description]} />
					</Field>

					<EntityImageUploadField
						label="Org avatar"
						kind="org-avatar"
						value={form.watch("avatarUrl") ?? ""}
						onChange={(value) => form.setValue("avatarUrl", value)}
						helperText="Square image recommended · max 2 MB"
					/>
					<EntityImageUploadField
						label="Org banner"
						kind="org-banner"
						value={form.watch("bannerUrl") ?? ""}
						onChange={(value) => form.setValue("bannerUrl", value)}
						helperText="Wide image recommended · max 4 MB"
					/>

					<div className="grid gap-3 sm:grid-cols-3">
						<Field>
							<FieldLabel htmlFor="org-website">Website</FieldLabel>
							<Input
								id="org-website"
								placeholder="https://example.com"
								{...form.register("website")}
							/>
							<FieldError errors={[form.formState.errors.website]} />
						</Field>
						<Field>
							<FieldLabel htmlFor="org-discord">Discord</FieldLabel>
							<Input
								id="org-discord"
								placeholder="https://discord.gg/example"
								{...form.register("discord")}
							/>
							<FieldError errors={[form.formState.errors.discord]} />
						</Field>
						<Field>
							<FieldLabel htmlFor="org-twitter">X / Twitter</FieldLabel>
							<Input
								id="org-twitter"
								placeholder="https://x.com/example"
								{...form.register("twitter")}
							/>
							<FieldError errors={[form.formState.errors.twitter]} />
						</Field>
					</div>

					<Field orientation="horizontal" className="justify-between rounded-md border p-3">
						<div className="space-y-1">
							<FieldLabel htmlFor="org-public">Public profile</FieldLabel>
							<p className="text-xs text-muted-foreground">
								Show this organization on public discovery pages.
							</p>
						</div>
						<Switch
							id="org-public"
							checked={form.watch("isPublic") !== false}
							onCheckedChange={(checked) => form.setValue("isPublic", checked)}
						/>
					</Field>

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={isPending}>
							{isPending && <Spinner className="mr-1.5" />}
							Create organization
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
