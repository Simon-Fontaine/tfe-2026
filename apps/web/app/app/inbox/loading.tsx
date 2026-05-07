import { PageSkeleton } from "@/components/workspace/page-skeleton";

export default function InboxLoading() {
	return <PageSkeleton header contentCards={1} variant="table" />;
}
