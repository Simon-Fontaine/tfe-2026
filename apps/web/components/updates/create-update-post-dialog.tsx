"use client";

import type { UpdatePostSummary, UpdatePostVisibility } from "@scrimflow/shared";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { apiRoutes } from "@/lib/routes";

type FormFieldErrors = Partial<Record<"title" | "body" | "visibility", string[]>>;

function getFieldErrorText(fieldErrors: FormFieldErrors, field: "title" | "body" | "visibility") {
	return fieldErrors[field]?.join(" ");
}

async function readApiPayload<T>(response: Response): Promise<{
	data?: T;
	error?: string;
	fieldErrors?: Record<string, string[]>;
}> {
	return response.json().catch(() => ({}));
}

interface CreateUpdatePostDialogProps {
	children: React.ReactNode;
	teamId: string;
	onCreated?: (post: UpdatePostSummary) => void;
}

export function CreateUpdatePostDialog({
	children,
	teamId,
	onCreated,
}: CreateUpdatePostDialogProps) {
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [visibility, setVisibility] = useState<UpdatePostVisibility>("workspace");
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
	const [submitting, setSubmitting] = useState(false);

	function reset() {
		setTitle("");
		setBody("");
		setVisibility("workspace");
		setFormError(undefined);
		setFieldErrors({});
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		setSubmitting(true);
		setFormError(undefined);
		setFieldErrors({});

		try {
			const response = await fetch(apiRoutes.updates.root, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					scopeType: "team",
					teamId,
					visibility,
					title,
					body,
				}),
			});
			const payload = await readApiPayload<UpdatePostSummary>(response);

			if (!response.ok || !payload.data) {
				setFieldErrors((payload.fieldErrors ?? {}) as FormFieldErrors);
				setFormError(payload.error ?? "Unable to publish update.");
				return;
			}

			onCreated?.(payload.data);
			toast.success("Update published.");
			reset();
			setOpen(false);
		} catch {
			setFormError("Unable to reach the API server.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) reset();
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Publish team update</DialogTitle>
					<DialogDescription>
						Announcements live in the dedicated updates feed now, separate from recruiting.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<Field>
						<FieldLabel>Title</FieldLabel>
						<Input
							value={title}
							onChange={(event) => {
								setTitle(event.target.value);
								setFieldErrors((current) => ({ ...current, title: undefined }));
								setFormError(undefined);
							}}
							maxLength={120}
							disabled={submitting}
						/>
						<FieldError>{getFieldErrorText(fieldErrors, "title")}</FieldError>
					</Field>

					<Field>
						<FieldLabel>Body</FieldLabel>
						<Textarea
							value={body}
							onChange={(event) => {
								setBody(event.target.value);
								setFieldErrors((current) => ({ ...current, body: undefined }));
								setFormError(undefined);
							}}
							rows={8}
							maxLength={4000}
							placeholder="Scrim results, roster changes, schedule shifts, or any team announcement."
							disabled={submitting}
						/>
						<FieldDescription>
							Workspace-only updates stay inside the team feed. Public updates also appear on the
							public updates directory.
						</FieldDescription>
						<FieldError>{getFieldErrorText(fieldErrors, "body")}</FieldError>
					</Field>

					<Field>
						<FieldLabel>Visibility</FieldLabel>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								size="sm"
								variant={visibility === "workspace" ? "default" : "outline"}
								onClick={() => {
									setVisibility("workspace");
									setFieldErrors((current) => ({ ...current, visibility: undefined }));
								}}
								disabled={submitting}
							>
								Workspace only
							</Button>
							<Button
								type="button"
								size="sm"
								variant={visibility === "public" ? "default" : "outline"}
								onClick={() => {
									setVisibility("public");
									setFieldErrors((current) => ({ ...current, visibility: undefined }));
								}}
								disabled={submitting}
							>
								Public
							</Button>
						</div>
						<FieldError>{getFieldErrorText(fieldErrors, "visibility")}</FieldError>
					</Field>

					{formError ? <p className="text-xs text-destructive">{formError}</p> : null}

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={submitting}>
							{submitting ? <Spinner className="mr-1.5" /> : null}
							Publish update
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => {
								reset();
								setOpen(false);
							}}
							disabled={submitting}
						>
							Cancel
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
