"use client";

import type { DirectUploadIntent, FinalizedUpload, OcrJobSummary } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useMemo, useRef, useState } from "react";
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
import { Spinner } from "@/components/ui/spinner";
import { apiRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { type FormFieldErrors, getFieldErrorText, readApiPayload } from "./form-errors";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

interface UploadScrimEvidenceDialogProps {
	children: React.ReactNode;
	scrimId: string;
}

export function UploadScrimEvidenceDialog({ children, scrimId }: UploadScrimEvidenceDialogProps) {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [screenshotType, setScreenshotType] = useState<"game_history" | "scoreboard">(
		"game_history"
	);
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
	const [submitting, setSubmitting] = useState(false);

	const buttonClassName = useMemo(
		() =>
			cn(
				"border px-3 py-3 text-left text-xs font-medium transition-colors hover:bg-muted",
				"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
			),
		[]
	);

	function resetState() {
		setFile(null);
		setScreenshotType("game_history");
		setFormError(undefined);
		setFieldErrors({});
		if (inputRef.current) inputRef.current.value = "";
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		const nextFieldErrors: FormFieldErrors = {};
		if (!file) {
			nextFieldErrors.file = ["Choose a screenshot before submitting."];
		} else {
			if (!ALLOWED_TYPES.includes(file.type)) {
				nextFieldErrors.file = ["Only JPEG, PNG, and WebP screenshots are allowed."];
			}
			if (file.size > MAX_BYTES) {
				nextFieldErrors.file = ["Screenshots must be smaller than 8 MB."];
			}
		}

		if (Object.keys(nextFieldErrors).length > 0) {
			setFieldErrors(nextFieldErrors);
			setFormError(undefined);
			return;
		}
		const selectedFile = file;
		if (!selectedFile) return;

		setSubmitting(true);
		setFormError(undefined);
		setFieldErrors({});
		const loading = toast.loading("Preparing upload…");

		try {
			const uploadIntentResponse = await fetch(apiRoutes.uploads.scrimEvidenceIntents, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					scrimId,
					screenshotType,
					fileName: selectedFile.name,
					contentType: selectedFile.type,
					sizeBytes: selectedFile.size,
				}),
			});
			const uploadIntentPayload = await readApiPayload<DirectUploadIntent>(uploadIntentResponse);

			if (!uploadIntentResponse.ok || !uploadIntentPayload.data) {
				setFieldErrors(uploadIntentPayload.fieldErrors ?? {});
				setFormError(uploadIntentPayload.error ?? "Unable to prepare the upload.");
				toast.error(uploadIntentPayload.error ?? "Unable to prepare the upload.", {
					id: loading,
				});
				return;
			}

			toast.loading("Uploading evidence…", { id: loading });
			const objectStorageResponse = await fetch(uploadIntentPayload.data.uploadUrl, {
				method: uploadIntentPayload.data.uploadMethod,
				headers: uploadIntentPayload.data.uploadHeaders,
				body: selectedFile,
			});
			if (!objectStorageResponse.ok) {
				setFormError("Direct upload failed before the evidence could be finalized.");
				toast.error("Direct upload failed before the evidence could be finalized.", {
					id: loading,
				});
				return;
			}

			toast.loading("Finalizing upload…", { id: loading });
			const finalizeResponse = await fetch(apiRoutes.uploads.scrimEvidenceFinalize, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					scrimId,
					screenshotType,
					objectKey: uploadIntentPayload.data.objectKey,
				}),
			});
			const finalizePayload = await readApiPayload<FinalizedUpload>(finalizeResponse);

			if (!finalizeResponse.ok || !finalizePayload.data) {
				setFieldErrors(finalizePayload.fieldErrors ?? {});
				setFormError(finalizePayload.error ?? "Unable to finalize the uploaded evidence.");
				toast.error(finalizePayload.error ?? "Unable to finalize the uploaded evidence.", {
					id: loading,
				});
				return;
			}

			toast.loading("Queueing OCR extraction…", { id: loading });
			const jobResponse = await fetch(apiRoutes.scrims.ocrJobs(scrimId), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					screenshotType,
					imageUrl: finalizePayload.data.url,
				}),
			});
			const jobPayload = await readApiPayload<OcrJobSummary>(jobResponse);

			if (!jobResponse.ok || !jobPayload.data) {
				setFieldErrors(jobPayload.fieldErrors ?? {});
				setFormError(jobPayload.error ?? "Unable to queue OCR extraction.");
				toast.error(jobPayload.error ?? "Unable to queue OCR extraction.", { id: loading });
				return;
			}

			toast.success("Evidence uploaded and OCR job queued.", { id: loading });
			resetState();
			setOpen(false);
			startTransition(() => {
				router.refresh();
			});
		} catch {
			setFormError("Unable to reach the API server.");
			toast.error("Unable to reach the API server.", { id: loading });
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) resetState();
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Upload scrim evidence</DialogTitle>
					<DialogDescription>
						The screenshot uploads directly to object storage, then the API finalizes it and queues
						async extraction. If the OCR worker is running, processing begins automatically after
						finalize succeeds.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<Field>
						<FieldLabel>Screenshot type</FieldLabel>
						<div className="grid gap-2 sm:grid-cols-2">
							<button
								type="button"
								data-selected={screenshotType === "game_history"}
								onClick={() => {
									setScreenshotType("game_history");
									setFormError(undefined);
								}}
								className={buttonClassName}
								disabled={submitting}
							>
								Game history
							</button>
							<button
								type="button"
								data-selected={screenshotType === "scoreboard"}
								onClick={() => {
									setScreenshotType("scoreboard");
									setFormError(undefined);
								}}
								className={buttonClassName}
								disabled={submitting}
							>
								Scoreboard
							</button>
						</div>
						<FieldDescription>
							Each screenshot becomes its own OCR job so match history and scoreboard parsing can
							evolve independently.
						</FieldDescription>
					</Field>

					<Field>
						<FieldLabel>Screenshot file</FieldLabel>
						<input
							ref={inputRef}
							type="file"
							accept={ALLOWED_TYPES.join(",")}
							onChange={(event) => {
								setFile(event.target.files?.[0] ?? null);
								setFieldErrors((current) => ({ ...current, file: undefined }));
								setFormError(undefined);
							}}
							disabled={submitting}
							className="block w-full text-xs file:mr-3 file:border file:bg-background file:px-3 file:py-2 file:text-xs file:font-medium"
						/>
						<FieldDescription>JPEG, PNG, or WebP up to 8 MB.</FieldDescription>
						<FieldError>{getFieldErrorText(fieldErrors, "file")}</FieldError>
					</Field>

					{formError ? <p className="text-xs text-destructive">{formError}</p> : null}

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={submitting}>
							{submitting && <Spinner className="mr-1.5" />}
							Queue upload
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => {
								resetState();
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
