import { PageSkeleton } from "@/components/dashboard/page-skeleton";

export default function Loading() {
	return <PageSkeleton header statsGrid={4} contentCards={2} />;
}
