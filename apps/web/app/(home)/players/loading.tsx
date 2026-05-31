import { PublicListLoading, PublicPageLoading } from "@/components/home/public-page-loading";

export default function PlayersLoading() {
	return (
		<PublicPageLoading titleWidthClassName="w-28" actionWidthClassName="w-44">
			<PublicListLoading itemCount={8} itemHeightClassName="h-14" />
		</PublicPageLoading>
	);
}
