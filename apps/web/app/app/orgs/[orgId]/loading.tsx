import { PageSkeleton } from "@/components/workspace/page-skeleton";

export default function OrgWorkspaceLoading() {
	return <PageSkeleton header statsGrid={4} contentCards={2} variant="grid" />;
}
