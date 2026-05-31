import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const maxWidthClasses = {
	"4xl": "max-w-4xl",
	"5xl": "max-w-5xl",
	"6xl": "max-w-6xl",
} as const;

interface PublicPageLoadingProps {
	children: ReactNode;
	maxWidth?: keyof typeof maxWidthClasses;
	titleWidthClassName?: string;
	descriptionWidthClassName?: string;
	actionWidthClassName?: string;
}

export function PublicPageLoading({
	children,
	maxWidth = "6xl",
	titleWidthClassName = "w-28",
	descriptionWidthClassName = "w-80",
	actionWidthClassName,
}: PublicPageLoadingProps) {
	return (
		<section className="border-b py-12 px-6" role="status" aria-busy="true">
			<span className="sr-only">Loading</span>
			<div className={cn("mx-auto flex flex-col gap-6", maxWidthClasses[maxWidth])}>
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="flex min-w-0 flex-1 flex-col gap-3">
						<Skeleton className={cn("h-7 max-w-full", titleWidthClassName)} />
						<Skeleton className={cn("h-4 max-w-full", descriptionWidthClassName)} />
					</div>
					{actionWidthClassName ? <Skeleton className={cn("h-9", actionWidthClassName)} /> : null}
				</div>
				{children}
			</div>
		</section>
	);
}

interface PublicGridLoadingProps {
	cardCount?: number;
	cardHeightClassName?: string;
}

export function PublicGridLoading({
	cardCount = 6,
	cardHeightClassName = "h-32",
}: PublicGridLoadingProps) {
	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: cardCount }, (_, index) => (
				<Skeleton key={`public-grid-${index + 1}`} className={cardHeightClassName} />
			))}
		</div>
	);
}

interface PublicListLoadingProps {
	itemCount?: number;
	itemHeightClassName?: string;
}

export function PublicListLoading({
	itemCount = 4,
	itemHeightClassName = "h-40",
}: PublicListLoadingProps) {
	return (
		<div className="flex flex-col gap-4">
			{Array.from({ length: itemCount }, (_, index) => (
				<Skeleton key={`public-list-${index + 1}`} className={itemHeightClassName} />
			))}
		</div>
	);
}
