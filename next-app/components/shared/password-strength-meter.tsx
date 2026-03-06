"use client";

import type { PasswordStrength } from "@/lib/validations/auth";

const strengthLabel: Record<PasswordStrength, string> = {
	weak: "Weak",
	fair: "Fair",
	strong: "Strong",
	"very-strong": "Very strong",
};

const strengthScore: Record<PasswordStrength, number> = {
	weak: 1,
	fair: 2,
	strong: 3,
	"very-strong": 4,
};

interface PasswordStrengthMeterProps {
	strength: PasswordStrength | null;
}

export function PasswordStrengthMeter({ strength }: PasswordStrengthMeterProps) {
	if (!strength) return null;

	const score = strengthScore[strength];

	return (
		<div className="mt-1" role="status" aria-live="polite">
			<div className="sf-pw-strength" aria-hidden="true">
				{[1, 2, 3, 4].map((i) => (
					<div
						key={i}
						className="sf-pw-strength-bar"
						data-active={i <= score ? "true" : undefined}
						data-strength={strength}
					/>
				))}
			</div>
			<span className="text-xs text-muted-foreground">
				Password strength: {strengthLabel[strength]}
			</span>
		</div>
	);
}
