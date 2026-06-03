"use client";

import type { UpdatePostSummary, UpdatePostVisibility } from "@scrimflow/shared";
import { apiRoutes } from "@scrimflow/shared";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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

type FormFieldErrors = Partial<Record<"title" | "body" | "visibility", string[]>>;

async function readApiPayload<T>(response: Response): Promise<{
	data?: T;
	error?: string;
	fieldErrors?: Record<string, string[]>;
}> {
	return response.json().catch(() => ({}));
}

interface EditUpdatePostDialogProps {
	post: UpdatePostSummary;
	onUpdated?: (post: UpdatePostSummary) => void;
	children?: React.ReactNode;
	open?: boolean;
	onClose?: () => void;
}

export function EditUpdatePostDialog({
	post,
	onUpdated,
	children,
	open: openProp,
	onClose,
}: EditUpdatePostDialogProps) {
	const isControlled = openProp !== undefined;
	const [openState, setOpenState] = useState(false);
	const open = isControlled ? openProp : openState;

	function handleOpenChange(next: boolean) {
		if (!isControlled) setOpenState(next);
		if (!next) onClose?.();
	}
	const [title, setTitle] = useState(post.title);
	const [body, setBody] = useState(post.body);
	const [visibility, setVisibility] = useState<UpdatePostVisibility>(post.visibility);
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
	const [submitting, setSubmitting] = useState(false);

	const postRef = useRef(post);
	postRef.current = post;

	useEffect(() => {
		if (!open) return;
		setTitle(postRef.current.title);
		setBody(postRef.current.body);
		setVisibility(postRef.current.visibility);
		setFormError(undefined);
		setFieldErrors({});
	}, [open]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		setSubmitting(true);
		setFormError(undefined);
		setFieldErrors({});

		try {
			const response = await fetch(apiRoutes.updates.byId(post.id), {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ title, body, visibility }),
			});
			const payload = await readApiPayload<UpdatePostSummary>(response);

			if (!response.ok || !payload.data) {
				setFieldErrors((payload.fieldErrors ?? {}) as FormFieldErrors);
				setFormError(payload.error ?? "Unable to save update.");
				return;
			}

			onUpdated?.(payload.data);
			toast.success("Update saved.");
			handleOpenChange(false);
		} catch {
			setFormError("Unable to reach the API server.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			{children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Edit update</DialogTitle>
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
						<FieldError>{fieldErrors.title?.join(" ")}</FieldError>
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
							disabled={submitting}
						/>
						<FieldError>{fieldErrors.body?.join(" ")}</FieldError>
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
						<FieldError>{fieldErrors.visibility?.join(" ")}</FieldError>
					</Field>

					{formError ? <p className="text-xs text-destructive">{formError}</p> : null}

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={submitting}>
							{submitting ? <Spinner className="mr-1.5" /> : null}
							Save update
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => handleOpenChange(false)}
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
