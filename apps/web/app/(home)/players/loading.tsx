import { PublicGridLoading, PublicPageLoading } from "@/components/home/public-page-loading";

export default function PlayersLoading() {
	return (
		<PublicPageLoading
			titleWidthClassName="w-28"
			descriptionWidthClassName="w-72"
			actionWidthClassName="w-44"
		>
			<PublicGridLoading />
		</PublicPageLoading>
	);
}
