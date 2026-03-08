"use client";

import { Delete01Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface CredentialListItemProps {
	icon: IconSvgElement;
	name: string;
	createdAt?: string;
	onDelete: () => void;
	disabled?: boolean;
}

export function CredentialListItem({
	icon,
	name,
	createdAt,
	onDelete,
	disabled,
}: CredentialListItemProps) {
	return (
		<div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
			<div className="flex items-center gap-2 min-w-0">
				<HugeiconsIcon
					icon={icon}
					strokeWidth={2}
					className="size-4 shrink-0 text-primary"
					aria-hidden="true"
				/>
				<div className="min-w-0">
					<span className="block truncate text-xs font-medium">{name}</span>
					{createdAt && (
						<p className="text-xs text-muted-foreground">
							Added {new Date(createdAt).toLocaleDateString()}
						</p>
					)}
				</div>
			</div>
			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="text-destructive"
						disabled={disabled}
					>
						<HugeiconsIcon
							icon={Delete01Icon}
							strokeWidth={2}
							className="mr-1.5 size-3.5"
							aria-hidden="true"
						/>
						Remove
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove "{name}"?</AlertDialogTitle>
						<AlertDialogDescription>
							This credential will be permanently removed. You won&apos;t be able to use it to sign
							in or verify your identity.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={onDelete}>Remove</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
