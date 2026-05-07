"use client";

import { PageError } from "@/components/workspace/page-error";

export default function ProfileError({
	error,
	reset,
	unstable_retry,
}: {
	error: Error & { digest?: string };
	reset?: () => void;
	unstable_retry?: () => void;
}) {
	return <PageError error={error} retry={unstable_retry} reset={reset} />;
}
