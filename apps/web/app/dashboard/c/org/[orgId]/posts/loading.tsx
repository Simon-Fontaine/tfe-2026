import { PageSkeleton } from "@/components/dashboard/page-skeleton";

export default function Loading() {
	return <PageSkeleton variant="grid" contentCards={3} />;
}
