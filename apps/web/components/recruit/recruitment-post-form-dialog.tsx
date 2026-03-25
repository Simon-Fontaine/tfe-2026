"use client";

import type { RecruitmentPostSummary } from "@scrimflow/shared";
import { useEffect, useMemo, useRef, useState } from "react";

import {
	createRecruitmentPostAction,
	updateRecruitmentPostAction,
} from "@/app/dashboard/recruit/actions/recruit";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import type { RecruitEntityOption } from "@/lib/recruitment";
import {
	categoryMatchesOwner,
	getDefaultCategoryForOwner,
	getDefaultMemberTypeForCategory,
	MEMBER_TYPE_LABELS,
	RECRUITMENT_CATEGORY_DESCRIPTIONS,
	RECRUITMENT_CATEGORY_LABELS,
	ROLE_LABELS,
	STAFF_ROLE_LABELS,
} from "@/lib/recruitment";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = ["lft", "lfp", "lfr", "lfs"] as const;
const OWNER_OPTIONS = [
	{ value: "player", label: "My profile" },
	{ value: "team", label: "Team" },
	{ value: "organization", label: "Organisation" },
] as const;
const STATUS_OPTIONS = ["open", "closed", "fulfilled"] as const;
const ROLE_OPTIONS = ["tank", "damage", "support"] as const;
const STAFF_OPTIONS = ["coach", "analyst", "manager", "staff"] as const;

type OwnerType = "player" | "team" | "organization";

interface RecruitmentPostFormDialogProps {
	children: React.ReactNode;
	mode?: "create" | "edit";
	post?: RecruitmentPostSummary;
	ownerOptions?: RecruitEntityOption[];
	fixedOwnerType?: OwnerType;
	fixedTeamId?: string;
	fixedOrganizationId?: string;
}

export function RecruitmentPostFormDialog({
	children,
	mode = "create",
	post,
	ownerOptions = [],
	fixedOwnerType,
	fixedTeamId,
	fixedOrganizationId,
}: RecruitmentPostFormDialogProps) {
	const [open, setOpen] = useState(false);
	const pendingRef = useRef(false);
	const [ownerType, setOwnerType] = useState<OwnerType>(
		fixedOwnerType ?? post?.ownerType ?? "player"
	);
	const [category, setCategory] = useState(
		post?.category ?? getDefaultCategoryForOwner(fixedOwnerType ?? "player")
	);
	const [status, setStatus] = useState(post?.status ?? "open");
	const [title, setTitle] = useState(post?.title ?? "");
	const [description, setDescription] = useState(post?.description ?? "");
	const [memberType, setMemberType] = useState<"player" | "staff">(
		post?.memberType ?? getDefaultMemberTypeForCategory(post?.category ?? category)
	);
	const [staffRole, setStaffRole] = useState(post?.staffRole ?? "staff");
	const [gameRoles, setGameRoles] = useState<Array<"tank" | "damage" | "support">>(
		post?.gameRoles ?? []
	);
	const [region, setRegion] = useState(post?.region ?? "");
	const [minRank, setMinRank] = useState(post?.minRank ?? "");
	const [maxRank, setMaxRank] = useState(post?.maxRank ?? "");
	const [minSr, setMinSr] = useState(post?.minSr?.toString() ?? "");
	const [maxSr, setMaxSr] = useState(post?.maxSr?.toString() ?? "");
	const [selectedEntityId, setSelectedEntityId] = useState(
		post?.teamId ?? post?.organizationId ?? fixedTeamId ?? fixedOrganizationId ?? ""
	);

	const action = mode === "create" ? createRecruitmentPostAction : updateRecruitmentPostAction;
	const { state, submit, isPending } = useFormAction(action, {
		loadingMessage: mode === "create" ? "Publishing post…" : "Saving post…",
		successMessage: mode === "create" ? "Post published" : "Post updated",
	});

	const availableOwnerTypes = useMemo(() => {
		if (fixedOwnerType) return [fixedOwnerType];
		return OWNER_OPTIONS.filter((option) => {
			if (option.value === "player") return true;
			return ownerOptions.some((entity) => entity.type === option.value);
		}).map((option) => option.value);
	}, [fixedOwnerType, ownerOptions]);

	const entityOptions = ownerOptions.filter((entity) => entity.type === ownerType);
	const effectiveOwnerType = fixedOwnerType ?? ownerType;
	const effectiveCategory = categoryMatchesOwner(category, effectiveOwnerType)
		? category
		: getDefaultCategoryForOwner(effectiveOwnerType);
	const effectiveMemberType = effectiveCategory === "lfs" ? "staff" : memberType;

	useEffect(() => {
		if (!categoryMatchesOwner(category, effectiveOwnerType)) {
			setCategory(getDefaultCategoryForOwner(effectiveOwnerType));
		}
	}, [category, effectiveOwnerType]);

	useEffect(() => {
		if (effectiveCategory === "lfs") {
			setMemberType("staff");
			setGameRoles([]);
		} else {
			setMemberType("player");
			setStaffRole("staff");
		}
	}, [effectiveCategory]);

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setOpen(false);
		}
	}, [state]);

	function resetState() {
		setOwnerType(fixedOwnerType ?? post?.ownerType ?? "player");
		setCategory(post?.category ?? getDefaultCategoryForOwner(fixedOwnerType ?? "player"));
		setStatus(post?.status ?? "open");
		setTitle(post?.title ?? "");
		setDescription(post?.description ?? "");
		setMemberType(post?.memberType ?? "player");
		setStaffRole(post?.staffRole ?? "staff");
		setGameRoles(post?.gameRoles ?? []);
		setRegion(post?.region ?? "");
		setMinRank(post?.minRank ?? "");
		setMaxRank(post?.maxRank ?? "");
		setMinSr(post?.minSr?.toString() ?? "");
		setMaxSr(post?.maxSr?.toString() ?? "");
		setSelectedEntityId(
			post?.teamId ?? post?.organizationId ?? fixedTeamId ?? fixedOrganizationId ?? ""
		);
	}

	function toggleGameRole(role: "tank" | "damage" | "support") {
		setGameRoles((current) =>
			current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
		);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		pendingRef.current = true;
		const fd = new FormData();
		if (post) fd.set("postId", post.id);
		fd.set("ownerType", effectiveOwnerType);
		fd.set("category", effectiveCategory);
		fd.set("title", title);
		fd.set("description", description);
		fd.set("memberType", effectiveMemberType);
		fd.set("region", region);
		fd.set("minRank", minRank);
		fd.set("maxRank", maxRank);
		fd.set("minSr", minSr);
		fd.set("maxSr", maxSr);
		if (mode === "edit") fd.set("status", status);
		if (effectiveOwnerType === "team") {
			fd.set("teamId", fixedTeamId ?? selectedEntityId);
		}
		if (effectiveOwnerType === "organization") {
			fd.set("organizationId", fixedOrganizationId ?? selectedEntityId);
		}
		if (effectiveMemberType === "staff") {
			fd.set("staffRole", staffRole);
		}
		for (const role of gameRoles) fd.append("gameRoles", role);
		submit(fd);
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
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{mode === "create" ? "New recruiting post" : "Edit recruiting post"}
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-5">
					{!fixedOwnerType && availableOwnerTypes.length > 1 && (
						<Field>
							<FieldLabel>Posting as</FieldLabel>
							<div className="grid gap-2 sm:grid-cols-3">
								{OWNER_OPTIONS.filter((option) => availableOwnerTypes.includes(option.value)).map(
									(option) => (
										<button
											key={option.value}
											type="button"
											data-selected={ownerType === option.value}
											onClick={() => setOwnerType(option.value)}
											className={cn(
												"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
												"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
											)}
										>
											{option.label}
										</button>
									)
								)}
							</div>
						</Field>
					)}

					{effectiveOwnerType !== "player" &&
						entityOptions.length > 1 &&
						!fixedTeamId &&
						!fixedOrganizationId && (
							<Field>
								<FieldLabel>{effectiveOwnerType === "team" ? "Team" : "Organisation"}</FieldLabel>
								<div className="grid gap-2">
									{entityOptions.map((entity) => (
										<button
											key={entity.id}
											type="button"
											data-selected={selectedEntityId === entity.id}
											onClick={() => setSelectedEntityId(entity.id)}
											className={cn(
												"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
												"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
											)}
										>
											{entity.label}
										</button>
									))}
								</div>
							</Field>
						)}

					<Field>
						<FieldLabel>Category</FieldLabel>
						<div className="grid gap-2 sm:grid-cols-2">
							{CATEGORY_OPTIONS.filter((option) =>
								categoryMatchesOwner(option, effectiveOwnerType)
							).map((option) => (
								<button
									key={option}
									type="button"
									data-selected={effectiveCategory === option}
									onClick={() => setCategory(option)}
									className={cn(
										"border px-3 py-3 text-left transition-colors hover:bg-muted",
										"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10"
									)}
								>
									<p className="text-xs font-semibold">{RECRUITMENT_CATEGORY_LABELS[option]}</p>
									<p className="mt-1 text-[11px] text-muted-foreground">
										{RECRUITMENT_CATEGORY_DESCRIPTIONS[option]}
									</p>
								</button>
							))}
						</div>
					</Field>

					<Field>
						<FieldLabel>Title</FieldLabel>
						<Input
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							maxLength={80}
							placeholder="Short headline for this opportunity"
						/>
					</Field>

					<Field>
						<FieldLabel>Description</FieldLabel>
						<Textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={5}
							maxLength={800}
							placeholder="What are you looking for, what level do you need, and what should responders know?"
						/>
					</Field>

					<Field>
						<FieldLabel>Target</FieldLabel>
						<div className="grid gap-2 sm:grid-cols-2">
							{(["player", "staff"] as const)
								.filter((option) => (effectiveCategory === "lfs" ? true : option === "player"))
								.map((option) => (
									<button
										key={option}
										type="button"
										data-selected={effectiveMemberType === option}
										onClick={() => setMemberType(option)}
										className={cn(
											"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
											"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
										)}
									>
										{MEMBER_TYPE_LABELS[option]}
									</button>
								))}
						</div>
					</Field>

					{effectiveMemberType === "staff" ? (
						<Field>
							<FieldLabel>Staff role</FieldLabel>
							<div className="grid gap-2 sm:grid-cols-2">
								{STAFF_OPTIONS.map((option) => (
									<button
										key={option}
										type="button"
										data-selected={staffRole === option}
										onClick={() => setStaffRole(option)}
										className={cn(
											"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
											"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
										)}
									>
										{STAFF_ROLE_LABELS[option]}
									</button>
								))}
							</div>
						</Field>
					) : (
						<>
							<Field>
								<FieldLabel>Game roles</FieldLabel>
								<div className="grid gap-2 sm:grid-cols-3">
									{ROLE_OPTIONS.map((option) => (
										<button
											key={option}
											type="button"
											data-selected={gameRoles.includes(option)}
											onClick={() => toggleGameRole(option)}
											className={cn(
												"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
												"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
											)}
										>
											{ROLE_LABELS[option]}
										</button>
									))}
								</div>
							</Field>

							<div className="grid gap-4 sm:grid-cols-2">
								<Field>
									<FieldLabel>Min rank</FieldLabel>
									<Input
										value={minRank}
										onChange={(e) => setMinRank(e.target.value)}
										placeholder="diamond"
									/>
								</Field>
								<Field>
									<FieldLabel>Max rank</FieldLabel>
									<Input
										value={maxRank}
										onChange={(e) => setMaxRank(e.target.value)}
										placeholder="champion"
									/>
								</Field>
								<Field>
									<FieldLabel>Min SR</FieldLabel>
									<Input
										value={minSr}
										onChange={(e) => setMinSr(e.target.value)}
										inputMode="numeric"
										placeholder="3200"
									/>
								</Field>
								<Field>
									<FieldLabel>Max SR</FieldLabel>
									<Input
										value={maxSr}
										onChange={(e) => setMaxSr(e.target.value)}
										inputMode="numeric"
										placeholder="4300"
									/>
								</Field>
							</div>
						</>
					)}

					<div className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel>Region</FieldLabel>
							<Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="EU" />
						</Field>

						{mode === "edit" && (
							<Field>
								<FieldLabel>Status</FieldLabel>
								<div className="grid gap-2 sm:grid-cols-3">
									{STATUS_OPTIONS.map((option) => (
										<button
											key={option}
											type="button"
											data-selected={status === option}
											onClick={() => setStatus(option)}
											className={cn(
												"border px-3 py-2 text-left text-xs font-medium capitalize transition-colors hover:bg-muted",
												"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
											)}
										>
											{option}
										</button>
									))}
								</div>
							</Field>
						)}
					</div>

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={isPending}>
							{isPending && <Spinner className="mr-1.5" />}
							{mode === "create" ? "Publish post" : "Save changes"}
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
