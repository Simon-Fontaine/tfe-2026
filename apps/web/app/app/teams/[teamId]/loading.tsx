import { PageSkeleton } from "@/components/workspace/page-skeleton";

export default function TeamWorkspaceLoading() {
	return <PageSkeleton header statsGrid={3} contentCards={2} />;
}
