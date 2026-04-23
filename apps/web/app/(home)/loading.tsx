import { PublicGridLoading, PublicPageLoading } from "@/components/home/public-page-loading";

export default function HomeLoading() {
	return (
		<PublicPageLoading maxWidth="6xl" titleWidthClassName="w-56" descriptionWidthClassName="w-80">
			<PublicGridLoading cardCount={3} cardHeightClassName="h-40" />
		</PublicPageLoading>
	);
}
