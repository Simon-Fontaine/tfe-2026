"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { type CreateTeamInput, CreateTeamSchema } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { createTeamAction } from "@/app/dashboard/workspace/teams/actions/team";
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

interface CreateTeamDialogProps {
	orgId: string;
	children: React.ReactNode;
}

export function CreateTeamDialog({ orgId, children }: CreateTeamDialogProps) {
	const router = useRouter();
	const pendingRef = useRef(false);

	const { state, submit, isPending } = useFormAction(createTeamAction, {
		loadingMessage: "Creating team…",
		successMessage: "Team created",
	});

	const form = useForm<CreateTeamInput>({
		resolver: valibotResolver(CreateTeamSchema),
		defaultValues: { orgId, name: "", tag: "", description: "" },
	});

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			const teamId = (state as { teamId?: string }).teamId;
			if (teamId) router.push(`/dashboard/workspace/teams/${teamId}`);
		}
	}, [state, router]);

	function onSubmit(values: CreateTeamInput) {
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("orgId", values.orgId);
		fd.set("name", values.name);
		fd.set("tag", values.tag);
		if (values.description) fd.set("description", values.description);
		submit(fd);
	}

	return (
		<Dialog
			onOpenChange={(open) => {
				if (open) form.reset({ orgId, name: "", tag: "", description: "" });
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create team</DialogTitle>
				</DialogHeader>

				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<Field>
						<FieldLabel htmlFor="team-name">Team name</FieldLabel>
						<Input
							id="team-name"
							placeholder="e.g. Main Roster"
							maxLength={50}
							{...form.register("name")}
						/>
						<FieldError errors={[form.formState.errors.name]} />
					</Field>

					<Field>
						<FieldLabel htmlFor="team-tag">
							Clan tag{" "}
							<span className="font-normal text-muted-foreground/70">(2–5 characters)</span>
						</FieldLabel>
						<Input
							id="team-tag"
							placeholder="e.g. TL"
							maxLength={5}
							className="font-mono uppercase"
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
							placeholder="A short description of this team"
							maxLength={280}
							rows={2}
							{...form.register("description")}
						/>
						<FieldError errors={[form.formState.errors.description]} />
					</Field>

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={isPending}>
							{isPending && <Spinner className="mr-1.5" />}
							Create team
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
