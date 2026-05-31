import { PageSkeleton } from "@/components/workspace/page-skeleton";

export default function AuditLogLoading() {
	return <PageSkeleton header contentCards={1} variant="table" />;
}
