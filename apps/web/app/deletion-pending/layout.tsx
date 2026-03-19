import { HugeiconsIcon } from "@hugeicons/react";
import { and, eq, gt, isNull } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { accountDeletionRequestTable } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";

export default async function DeletionPendingLayout({ children }: { children: ReactNode }) {
	const { session, user } = await getCurrentSession();
	if (!session || !user) redirect("/auth");

	const pending = await db.query.accountDeletionRequestTable.findFirst({
		where: and(
			eq(accountDeletionRequestTable.userId, user.id),
			isNull(accountDeletionRequestTable.cancelledAt),
			gt(accountDeletionRequestTable.scheduledDeletionAt, new Date())
		),
		columns: { id: true },
	});
	if (!pending) redirect("/dashboard");

	return (
		<div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
			<Link href="/" className="mb-6 flex items-center gap-2 text-inherit no-underline">
				<HugeiconsIcon icon={siteConfig.logo} strokeWidth={2} className="size-5 text-primary" />
				<span className="text-sm font-bold">{siteConfig.name}</span>
			</Link>

			<div className="w-full max-w-sm">
				<Card>
					<CardContent className="p-6">{children}</CardContent>
				</Card>
			</div>

			<footer className="mt-6 text-xs text-muted-foreground">
				&copy; {new Date().getFullYear()} {siteConfig.footer.copyright} &middot; All rights reserved
			</footer>
		</div>
	);
}
