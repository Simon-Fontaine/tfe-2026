"use client";

import { useEffect, useState } from "react";
import { createTeamJoinRequestAction } from "@/app/dashboard/teams/[teamId]/actions/invites";
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
import { cn } from "@/lib/utils";

const ROLES = [
	{ value: "tank", label: "Tank" },
	{ value: "damage", label: "DPS" },
	{ value: "support", label: "Support" },
] as const;

interface RequestJoinTeamDialogProps {
	teamId: string;
	children: React.ReactNode;
}

export function RequestJoinTeamDialog({ teamId, children }: RequestJoinTeamDialogProps) {
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [requestedRoleInTeam, setRequestedRoleInTeam] = useState<"tank" | "damage" | "support">(
		"damage"
	);
	const { state, submit, isPending } = useFormAction(createTeamJoinRequestAction, {
		loadingMessage: "Sending request…",
		successMessage: "Join request sent",
	});

	useEffect(() => {
		if (state?.success) {
			setOpen(false);
			setMessage("");
			setRequestedRoleInTeam("damage");
		}
	}, [state]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const fd = new FormData();
		fd.set("teamId", teamId);
		fd.set("requestedRoleInTeam", requestedRoleInTeam);
		if (message.trim()) fd.set("message", message.trim());
		submit(fd);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Request to join team</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<Field>
						<FieldLabel>Preferred role</FieldLabel>
						<div className="flex gap-2">
							{ROLES.map((role) => (
								<button
									key={role.value}
									type="button"
									data-selected={requestedRoleInTeam === role.value}
									onClick={() => setRequestedRoleInTeam(role.value)}
									className={cn(
										"flex-1 border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted",
										"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
									)}
								>
									{role.label}
								</button>
							))}
						</div>
					</Field>
					<Field>
						<FieldLabel>Message</FieldLabel>
						<Textarea
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder="Tell the team a bit about your experience and availability"
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
