"use client";

import { Alert01Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";

export function InboxErrorBlock() {
	const router = useRouter();
	return (
		<div className="flex flex-1 items-center justify-center p-6">
			<EmptyStateBlock
				icon={Alert01Icon}
				title="Unable to load inbox"
				description="Something went wrong while loading your notifications."
				variant="card"
				actionLabel="Retry"
				onAction={() => router.refresh()}
			/>
		</div>
	);
}
