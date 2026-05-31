import { PublicListLoading, PublicPageLoading } from "@/components/home/public-page-loading";

export default function UpdatesLoading() {
	return (
		<PublicPageLoading maxWidth="5xl" titleWidthClassName="w-28" actionWidthClassName="w-48">
			<PublicListLoading />
		</PublicPageLoading>
	);
}
