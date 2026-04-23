"use client";

import { PublicPageError } from "@/components/home/public-page-error";

export default function HomeError({
	error,
	reset,
	unstable_retry,
}: {
	error: Error & { digest?: string };
	reset?: () => void;
	unstable_retry?: () => void;
}) {
	return (
		<PublicPageError
			error={error}
			reset={reset}
			retry={unstable_retry}
			title="Public page unavailable"
			description="This public route did not finish rendering. Reload the segment to try again."
		/>
	);
}
