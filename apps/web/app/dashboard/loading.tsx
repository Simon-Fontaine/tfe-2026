import { PageSkeleton } from "@/components/dashboard/page-skeleton";

export default function DashboardLoading() {
	return <PageSkeleton header statsGrid={3} contentCards={2} />;
}
