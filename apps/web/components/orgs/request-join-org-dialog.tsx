"use client";

import { useEffect, useState } from "react";
import { createOrgJoinRequestAction } from "@/app/dashboard/orgs/actions/org";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";

interface RequestJoinOrgDialogProps {
	orgId: string;
	children: React.ReactNode;
}

export function RequestJoinOrgDialog({ orgId, children }: RequestJoinOrgDialogProps) {
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState("");
	const { state, submit, isPending } = useFormAction(createOrgJoinRequestAction, {
		loadingMessage: "Sending request…",
		successMessage: "Join request sent",
	});

	useEffect(() => {
		if (state?.success) {
			setOpen(false);
			setMessage("");
		}
	}, [state]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const fd = new FormData();
		fd.set("orgId", orgId);
		if (message.trim()) fd.set("message", message.trim());
		submit(fd);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Request to join org</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<Field>
						<FieldLabel>Message</FieldLabel>
						<Textarea
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder="Share a short intro or what you'd like to contribute"
							rows={4}
							maxLength={500}
						/>
					</Field>
					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={isPending}>
							{isPending && <Spinner className="mr-1.5" />}
							Send request
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
