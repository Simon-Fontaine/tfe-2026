"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { useForm } from "react-hook-form";

import { updateBasicInfoAction } from "@/app/dashboard/profile/actions/update-basic-info";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { type UpdateBasicInfoInput, UpdateBasicInfoSchema } from "@/lib/validations/profile";

const SOCIAL_FIELDS = [
	{ key: "twitter", label: "Twitter / X" },
	{ key: "discord", label: "Discord" },
	{ key: "twitch", label: "Twitch" },
	{ key: "youtube", label: "YouTube" },
] as const;

interface BasicInfoSectionProps {
	displayName: string;
	bio: string;
	socialLinks: Record<string, string>;
}

export function BasicInfoSection({ displayName, bio, socialLinks }: BasicInfoSectionProps) {
	const { submit, isPending } = useFormAction(updateBasicInfoAction, {
		loadingMessage: "Saving…",
		successMessage: "Profile updated",
	});

	const form = useForm<UpdateBasicInfoInput>({
		resolver: valibotResolver(UpdateBasicInfoSchema),
		defaultValues: {
			displayName,
			bio: bio ?? "",
			socialLinks: {
				twitter: socialLinks.twitter ?? "",
				discord: socialLinks.discord ?? "",
				twitch: socialLinks.twitch ?? "",
				youtube: socialLinks.youtube ?? "",
			},
		},
	});

	const bioValue = form.watch("bio") ?? "";

	function onSubmit(values: UpdateBasicInfoInput) {
		const formData = new FormData();
		formData.set("displayName", values.displayName);
		if (values.bio) formData.set("bio", values.bio);
		if (values.socialLinks?.twitter) formData.set("twitter", values.socialLinks.twitter);
		if (values.socialLinks?.discord) formData.set("discord", values.socialLinks.discord);
		if (values.socialLinks?.twitch) formData.set("twitch", values.socialLinks.twitch);
		if (values.socialLinks?.youtube) formData.set("youtube", values.socialLinks.youtube);
		submit(formData);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle>Basic info</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					{/* Display name */}
					<Field>
						<FieldLabel htmlFor="displayName">Display name</FieldLabel>
						<Input id="displayName" {...form.register("displayName")} />
						<FieldError errors={[form.formState.errors.displayName]} />
					</Field>

					{/* Bio */}
					<Field>
						<div className="flex items-center justify-between">
							<FieldLabel htmlFor="bio">Bio</FieldLabel>
							<span className="text-[10px] text-muted-foreground">{bioValue.length}/280</span>
						</div>
						<Textarea
							id="bio"
							rows={3}
							maxLength={280}
							placeholder="Tell teams about yourself…"
							{...form.register("bio")}
						/>
						<FieldError errors={[form.formState.errors.bio]} />
					</Field>

					{/* Social links */}
					<FieldGroup>
						<p className="text-xs font-medium">Social links</p>
						{SOCIAL_FIELDS.map(({ key, label }) => (
							<Field key={key}>
								<FieldLabel htmlFor={key}>{label}</FieldLabel>
								<InputGroup>
									<InputGroupAddon>
										<InputGroupText>{label.split(" ")[0]}</InputGroupText>
									</InputGroupAddon>
									<InputGroupInput
										id={key}
										placeholder="Username or URL"
										{...form.register(`socialLinks.${key}`)}
									/>
								</InputGroup>
							</Field>
						))}
					</FieldGroup>

					<Button type="submit" size="sm" disabled={isPending}>
						{isPending && <Spinner className="mr-1.5" />}
						Save changes
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
