"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

interface LoadMoreButtonProps {
	nextCursor: string;
	cursorParam?: string;
	label?: string;
}

export function LoadMoreButton({
	nextCursor,
	cursorParam = "cursor",
	label = "Load more",
}: LoadMoreButtonProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();

	function handleLoadMore() {
		const params = new URLSearchParams(searchParams.toString());
		params.set(cursorParam, nextCursor);
		startTransition(() => {
			router.push(`${pathname}?${params.toString()}`);
		});
	}

	return (
		<div className="flex justify-center pt-4">
			<Button variant="outline" size="sm" onClick={handleLoadMore} disabled={isPending}>
				{isPending ? "Loading..." : label}
			</Button>
		</div>
	);
}
