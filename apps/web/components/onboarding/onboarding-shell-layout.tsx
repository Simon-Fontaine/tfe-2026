"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { siteConfig } from "@/lib/config/site";
import { useOnboardingFlow } from "@/stores/onboarding-flow";

const STEP_PROGRESS = {
	battletag: 33,
	"roles-and-rank": 66,
	"hero-pool": 100,
} as const;

const STEP_LABELS = {
	battletag: "Step 1 of 3",
	"roles-and-rank": "Step 2 of 3",
	"hero-pool": "Step 3 of 3",
} as const;

export function OnboardingShellLayout({ children }: { children: ReactNode }) {
	const { step } = useOnboardingFlow();

	return (
		<div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
			<Link href="/" className="mb-6 flex items-center gap-2 text-inherit no-underline">
				<HugeiconsIcon icon={siteConfig.logo} strokeWidth={2} className="size-5 text-primary" />
				<span className="text-sm font-bold">{siteConfig.name}</span>
			</Link>

			<div className="w-full max-w-2xl space-y-2">
				<div className="flex items-center justify-between px-0.5 text-xs text-muted-foreground">
					<span>Player setup</span>
					<span>{STEP_LABELS[step]}</span>
				</div>
				<Progress value={STEP_PROGRESS[step]} />

				<Card className="mt-3">
					<CardContent className="p-6">{children}</CardContent>
				</Card>
			</div>

			<footer className="mt-6 text-xs text-muted-foreground">
				&copy; {new Date().getFullYear()} {siteConfig.footer.copyright} &middot; All rights reserved
			</footer>
		</div>
	);
}
