"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { type CreateOrgInput, CreateOrgSchema } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { createOrgAction } from "@/app/dashboard/workspace/orgs/actions/org";
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

interface CreateOrgDialogProps {
	children: React.ReactNode;
}

export function CreateOrgDialog({ children }: CreateOrgDialogProps) {
	const router = useRouter();
	const openRef = useRef(false);
	const pendingRef = useRef(false);

	const { state, submit, isPending } = useFormAction(createOrgAction, {
		loadingMessage: "Creating organisation…",
		successMessage: "Organisation created",
	});

	const form = useForm<CreateOrgInput>({
		resolver: valibotResolver(CreateOrgSchema),
		defaultValues: { name: "", description: "" },
	});

	// Close dialog and navigate to new org on success.
	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			openRef.current = false;
			const orgId = (state as { orgId?: string }).orgId;
			if (orgId) router.push(`/dashboard/workspace/orgs/${orgId}`);
		}
	}, [state, router]);

	function onSubmit(values: CreateOrgInput) {
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("name", values.name);
		if (values.description) fd.set("description", values.description);
		submit(fd);
	}

	return (
		<Dialog
			onOpenChange={(open) => {
				openRef.current = open;
				if (open) form.reset();
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create organisation</DialogTitle>
				</DialogHeader>

				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<Field>
						<FieldLabel htmlFor="org-name">Organisation name</FieldLabel>
						<Input
							id="org-name"
							placeholder="e.g. Team Liquid"
							maxLength={50}
							{...form.register("name")}
						/>
						<FieldError errors={[form.formState.errors.name]} />
					</Field>

					<Field>
						<FieldLabel htmlFor="org-description">
							Description <span className="font-normal text-muted-foreground/70">(optional)</span>
						</FieldLabel>
						<Textarea
							id="org-description"
							placeholder="A short description of your organisation"
							maxLength={280}
							rows={3}
							{...form.register("description")}
						/>
						<FieldError errors={[form.formState.errors.description]} />
					</Field>

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={isPending}>
							{isPending && <Spinner className="mr-1.5" />}
							Create
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
