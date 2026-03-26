"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { type UpdateTeamInput, UpdateTeamSchema } from "@scrimflow/shared";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { updateTeamAction } from "@/app/dashboard/workspace/orgs/actions/team";
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
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";

interface EditTeamDialogProps {
	teamId: string;
	initialValues: {
		name: string;
		tag: string;
		description: string | null;
		avatarUrl?: string | null;
		bannerUrl?: string | null;
	};
	children: React.ReactNode;
}

export function EditTeamDialog({ teamId, initialValues, children }: EditTeamDialogProps) {
	const [open, setOpen] = useState(false);
	const pendingRef = useRef(false);

	const { state, submit, isPending } = useFormAction(updateTeamAction, {
		loadingMessage: "Saving changes…",
		successMessage: "Team updated",
	});

	const form = useForm<UpdateTeamInput>({
		resolver: valibotResolver(UpdateTeamSchema),
		defaultValues: {
			teamId,
			name: initialValues.name,
			tag: initialValues.tag,
			description: initialValues.description ?? "",
			avatarUrl: initialValues.avatarUrl ?? "",
			bannerUrl: initialValues.bannerUrl ?? "",
		},
	});

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setOpen(false);
		}
	}, [state]);

	function onSubmit(values: UpdateTeamInput) {
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("teamId", values.teamId);
		fd.set("name", values.name);
		fd.set("tag", values.tag);
		if (values.description) fd.set("description", values.description);
		if (values.avatarUrl) fd.set("avatarUrl", values.avatarUrl);
		if (values.bannerUrl) fd.set("bannerUrl", values.bannerUrl);
		submit(fd);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (o) {
					form.reset({
						teamId,
						name: initialValues.name,
						tag: initialValues.tag,
						description: initialValues.description ?? "",
						avatarUrl: initialValues.avatarUrl ?? "",
						bannerUrl: initialValues.bannerUrl ?? "",
					});
				}
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit team</DialogTitle>
				</DialogHeader>

				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<Field>
						<FieldLabel htmlFor="team-name">Team name</FieldLabel>
						<Input
							id="team-name"
							placeholder="e.g. Hestia Black"
							maxLength={50}
							{...form.register("name")}
						/>
						<FieldError errors={[form.formState.errors.name]} />
					</Field>

					<Field>
						<FieldLabel htmlFor="team-tag">Tag</FieldLabel>
						<Input
							id="team-tag"
							placeholder="e.g. HBL"
							maxLength={5}
							className="uppercase"
							{...form.register("tag")}
						/>
						<FieldError errors={[form.formState.errors.tag]} />
					</Field>

					<Field>
						<FieldLabel htmlFor="team-description">
							Description <span className="font-normal text-muted-foreground/70">(optional)</span>
						</FieldLabel>
						<Textarea
							id="team-description"
							placeholder="A short description of your team"
							maxLength={280}
							rows={3}
							{...form.register("description")}
						/>
						<FieldError errors={[form.formState.errors.description]} />
					</Field>

					<EntityImageUploadField
						label="Team avatar"
						kind="team-avatar"
						value={form.watch("avatarUrl") ?? ""}
						onChange={(value) => form.setValue("avatarUrl", value)}
						helperText="Square image recommended · max 2 MB"
					/>
					<EntityImageUploadField
						label="Team banner"
						kind="team-banner"
						value={form.watch("bannerUrl") ?? ""}
						onChange={(value) => form.setValue("bannerUrl", value)}
						helperText="Wide image recommended · max 4 MB"
					/>

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={isPending}>
							{isPending && <Spinner className="mr-1.5" />}
							Save changes
						</Button>
						<Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
