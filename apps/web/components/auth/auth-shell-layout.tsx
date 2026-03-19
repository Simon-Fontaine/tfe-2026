"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/lib/config/site";

export function AuthShellLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
			<Link href="/" className="mb-6 flex items-center gap-2 text-inherit no-underline">
				<HugeiconsIcon icon={siteConfig.logo} strokeWidth={2} className="size-5 text-primary" />
				<span className="text-sm font-bold">{siteConfig.name}</span>
			</Link>

			<Card className="w-full max-w-md">
				<CardContent className="p-6">{children}</CardContent>
			</Card>

			<footer className="mt-6 text-xs text-muted-foreground">
				&copy; {new Date().getFullYear()} {siteConfig.footer.copyright} &middot; All rights reserved
			</footer>
		</div>
	);
}
