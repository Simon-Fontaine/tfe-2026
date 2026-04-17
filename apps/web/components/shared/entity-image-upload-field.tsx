"use client";

import { Camera01Icon, Delete01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { apiRoutes } from "@/lib/routes";

type UploadKind = "org-avatar" | "org-banner" | "team-avatar" | "team-banner";

const KIND_CONFIG: Record<UploadKind, { maxBytes: number; aspect?: string }> = {
	"org-avatar": { maxBytes: 2 * 1024 * 1024 },
	"org-banner": { maxBytes: 4 * 1024 * 1024, aspect: "aspect-[4/1]" },
	"team-avatar": { maxBytes: 2 * 1024 * 1024 },
	"team-banner": { maxBytes: 4 * 1024 * 1024, aspect: "aspect-[4/1]" },
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface EntityImageUploadFieldProps {
	label: string;
	kind: UploadKind;
	value: string;
	onChange: (next: string) => void;
	helperText?: string;
}

export function EntityImageUploadField({
	label,
	kind,
	value,
	onChange,
	helperText,
}: EntityImageUploadFieldProps) {
	const [uploading, setUploading] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const config = KIND_CONFIG[kind];

	async function upload(file: File) {
		if (!ALLOWED_TYPES.includes(file.type)) {
			toast.error("Only JPEG, PNG and WebP images are allowed.");
			return;
		}
		if (file.size > config.maxBytes) {
			toast.error(`Image must be smaller than ${config.maxBytes / (1024 * 1024)} MB.`);
			return;
		}

		setUploading(true);
		const loading = toast.loading("Uploading image…");
		try {
			const formData = new FormData();
			formData.set("file", file);
			formData.set("kind", kind);

			const res = await fetch(apiRoutes.uploads.assets, { method: "POST", body: formData });
			const data = (await res.json()) as { url?: string; error?: string };
			if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed.");
			onChange(data.url);
			toast.success("Image uploaded.", { id: loading });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Upload failed.", { id: loading });
		} finally {
			setUploading(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	return (
		<Field>
			<FieldLabel>{label}</FieldLabel>
			<div className="space-y-2">
				<div className="relative overflow-hidden border bg-muted">
					{config.aspect ? (
						<div className={`relative w-full ${config.aspect}`}>
							{value ? (
								<Image src={value} alt={label} fill className="object-cover" unoptimized />
							) : null}
						</div>
					) : (
						<div className="flex h-24 w-24 items-center justify-center bg-muted">
							{value ? (
								<Image
									src={value}
									alt={label}
									width={96}
									height={96}
									className="h-full w-full object-cover"
									unoptimized
								/>
							) : null}
						</div>
					)}
				</div>

				<div className="flex gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => inputRef.current?.click()}
						disabled={uploading}
					>
						<HugeiconsIcon icon={Camera01Icon} className="mr-1 size-3.5" />
						{uploading ? "Uploading…" : "Upload image"}
					</Button>
					{value ? (
						<Button type="button" size="sm" variant="outline" onClick={() => onChange("")}>
							<HugeiconsIcon icon={Delete01Icon} className="mr-1 size-3.5" />
							Remove
						</Button>
					) : null}
				</div>
			</div>
			<FieldDescription>{helperText ?? "JPEG, PNG, WebP."}</FieldDescription>
			<input
				ref={inputRef}
				type="file"
				className="hidden"
				accept={ALLOWED_TYPES.join(",")}
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) void upload(file);
				}}
				disabled={uploading}
			/>
		</Field>
	);
}
