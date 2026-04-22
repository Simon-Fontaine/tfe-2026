"use client";

import { PageError } from "@/components/workspace/page-error";

export default function OrganizationsError({
	error,
	reset,
	unstable_retry,
}: {
	error: Error & { digest?: string };
	reset?: () => void;
	unstable_retry?: () => void;
}) {
	return (
		<PageError
			error={error}
			retry={unstable_retry}
			reset={reset}
			title="Failed to load organisations"
		/>
	);
}
