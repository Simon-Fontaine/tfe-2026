"use client";

import { EyeIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";

interface PasswordInputProps extends Omit<React.ComponentProps<"input">, "type"> {}

export function PasswordInput({ className, ref, ...props }: PasswordInputProps) {
	const [visible, setVisible] = useState(false);

	return (
		<InputGroup>
			<InputGroupInput
				ref={ref}
				type={visible ? "text" : "password"}
				className={className}
				{...props}
			/>
			<InputGroupAddon align="inline-end">
				<InputGroupButton
					size="icon-xs"
					onClick={() => setVisible((v) => !v)}
					aria-label={visible ? "Hide password" : "Show password"}
				>
					<HugeiconsIcon
						icon={visible ? ViewOffIcon : EyeIcon}
						strokeWidth={2}
						className="size-4"
					/>
				</InputGroupButton>
			</InputGroupAddon>
		</InputGroup>
	);
}
