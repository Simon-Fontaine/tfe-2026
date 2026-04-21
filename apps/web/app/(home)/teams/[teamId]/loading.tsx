import { PublicPageLoading } from "@/components/home/public-page-loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamProfileLoading() {
	return (
		<PublicPageLoading maxWidth="4xl" titleWidthClassName="w-40" descriptionWidthClassName="w-60">
			<Skeleton className="h-36 w-full" />
			<Skeleton className="h-32 w-full" />
			<Skeleton className="h-24 w-full" />
			<Skeleton className="h-40 w-full" />
		</PublicPageLoading>
	);
}
