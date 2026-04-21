import { PublicPageLoading } from "@/components/home/public-page-loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlayerProfileLoading() {
	return (
		<PublicPageLoading maxWidth="4xl" titleWidthClassName="w-36" descriptionWidthClassName="w-56">
			<Skeleton className="h-36 w-full" />
			<Skeleton className="h-28 w-full" />
			<Skeleton className="h-40 w-full" />
		</PublicPageLoading>
	);
}
