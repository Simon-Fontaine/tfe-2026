import { PageSkeleton } from "@/components/dashboard/page-skeleton";

export default function Loading() {
	return <PageSkeleton header={false} variant="form" contentCards={3} />;
}
