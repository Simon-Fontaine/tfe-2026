"use client";

import { Camera01Icon, Delete01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

interface BannerUploadSectionProps {
	bannerUrl: string | null;
}

export function BannerUploadSection({ bannerUrl: initialBannerUrl }: BannerUploadSectionProps) {
	const [bannerUrl, setBannerUrl] = useState<string | null>(initialBannerUrl);
	const [preview, setPreview] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [removing, setRemoving] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const displayUrl = preview ?? bannerUrl;
	const isBusy = uploading || removing;

	async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		if (!ALLOWED_TYPES.includes(file.type)) {
			toast.error("Only JPEG, PNG and WebP images are allowed");
			return;
		}
		if (file.size > MAX_BYTES) {
			toast.error("Image must be smaller than 4 MB");
			return;
		}

		const objectUrl = URL.createObjectURL(file);
		setPreview(objectUrl);
		setUploading(true);
		const id = toast.loading("Uploading banner…");

		try {
			const formData = new FormData();
			formData.append("file", file);

			const res = await fetch("/api/upload/banner", { method: "POST", body: formData });
			const data = (await res.json()) as { url?: string; error?: string };

			if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");

			setBannerUrl(data.url);
			setPreview(null);
			URL.revokeObjectURL(objectUrl);
			toast.success("Banner updated", { id });
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
		const id = toast.loading("Removing banner…");

		try {
			const res = await fetch("/api/upload/banner", { method: "DELETE" });
			const data = (await res.json()) as { success?: boolean; error?: string };

			if (!res.ok || !data.success) throw new Error(data.error ?? "Remove failed");

			setBannerUrl(null);
			toast.success("Banner removed", { id });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Remove failed", { id });
		} finally {
			setRemoving(false);
		}
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm">Banner</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="relative aspect-[4/1] w-full overflow-hidden border bg-muted">
					{displayUrl && (
						<Image
							src={displayUrl}
							alt="Profile banner"
							fill
							unoptimized
							className="object-cover"
						/>
					)}
				</div>

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
							{uploading ? "Uploading…" : "Change banner"}
						</Button>

						{bannerUrl && (
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

					<p className="text-[10px] text-muted-foreground">
						JPEG, PNG or WebP · max 4 MB · recommended 1200 × 300
					</p>
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
