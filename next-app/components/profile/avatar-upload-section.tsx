"use client";

import { Camera01Icon, Delete01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

interface AvatarUploadSectionProps {
	avatarUrl: string | null;
}

export function AvatarUploadSection({ avatarUrl: initialAvatarUrl }: AvatarUploadSectionProps) {
	const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
	const [preview, setPreview] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [removing, setRemoving] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const displayUrl = preview ?? avatarUrl;
	const isBusy = uploading || removing;

	async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		if (!ALLOWED_TYPES.includes(file.type)) {
			toast.error("Only JPEG, PNG and WebP images are allowed");
			return;
		}
		if (file.size > MAX_BYTES) {
			toast.error("Image must be smaller than 2 MB");
			return;
		}

		const objectUrl = URL.createObjectURL(file);
		setPreview(objectUrl);
		setUploading(true);
		const id = toast.loading("Uploading avatar…");

		try {
			const formData = new FormData();
			formData.append("file", file);

			const res = await fetch("/api/upload/avatar", { method: "POST", body: formData });
			const data = (await res.json()) as { url?: string; error?: string };

			if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");

			setAvatarUrl(data.url);
			setPreview(null);
			URL.revokeObjectURL(objectUrl);
			toast.success("Avatar updated", { id });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Upload failed", { id });
			setPreview(null);
			URL.revokeObjectURL(objectUrl);
		} finally {
			setUploading(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	async function handleRemove() {
		setRemoving(true);
		const id = toast.loading("Removing avatar…");

		try {
			const res = await fetch("/api/upload/avatar", { method: "DELETE" });
			const data = (await res.json()) as { success?: boolean; error?: string };

			if (!res.ok || !data.success) throw new Error(data.error ?? "Remove failed");

			setAvatarUrl(null);
			toast.success("Avatar removed", { id });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Remove failed", { id });
		} finally {
			setRemoving(false);
		}
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm">Avatar</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<Avatar className="size-16 shrink-0 rounded-none overflow-hidden after:rounded-none">
						<AvatarImage className="rounded-none" src={displayUrl ?? undefined} />
						<AvatarFallback className="rounded-none">?</AvatarFallback>
					</Avatar>

					<div className="space-y-1.5">
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={isBusy}
								onClick={() => inputRef.current?.click()}
								className="gap-1.5"
							>
								<HugeiconsIcon icon={Camera01Icon} strokeWidth={2} className="size-3.5" />
								{uploading ? "Uploading…" : "Change avatar"}
							</Button>

							{avatarUrl && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isBusy}
									onClick={handleRemove}
									className="gap-1.5 text-destructive hover:text-destructive"
								>
									<HugeiconsIcon icon={Delete01Icon} strokeWidth={2} className="size-3.5" />
									{removing ? "Removing…" : "Remove"}
								</Button>
							)}
						</div>

						<p className="text-[10px] text-muted-foreground">JPEG, PNG or WebP · max 2 MB</p>
					</div>
				</div>

				<input
					ref={inputRef}
					type="file"
					accept={ALLOWED_TYPES.join(",")}
					className="hidden"
					onChange={handleFileChange}
					disabled={isBusy}
				/>
			</CardContent>
		</Card>
	);
}
