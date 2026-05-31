import Link from "next/link";

type PublicRelatedRouteCard = {
	label: string;
	href: string;
};

interface PublicRelatedRouteCardsProps {
	cards: PublicRelatedRouteCard[];
}

export function PublicRelatedRouteCards({ cards }: PublicRelatedRouteCardsProps) {
	return (
		<div className="divide-y border">
			{cards.map((card) => (
				<Link
					key={card.href}
					href={card.href}
					className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
				>
					<span className="text-sm font-medium">{card.label}</span>
				</Link>
			))}
		</div>
	);
}
