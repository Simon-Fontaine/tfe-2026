"use client";

import { PageError } from "@/components/workspace/page-error";

export default function AppError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return <PageError error={error} reset={reset} />;
}
