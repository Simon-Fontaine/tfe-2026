import { cn } from "@/lib/utils";

const maxWidthClasses = {
	"4xl": "max-w-4xl",
	"5xl": "max-w-5xl",
	"6xl": "max-w-6xl",
	full: "max-w-full",
} as const;

interface PageContainerProps {
	children: React.ReactNode;
	maxWidth?: keyof typeof maxWidthClasses;
	className?: string;
}

export function PageContainer({ children, maxWidth = "6xl", className }: PageContainerProps) {
	return (
		<div className={cn("mx-auto w-full space-y-8 p-6", maxWidthClasses[maxWidth], className)}>
			{children}
		</div>
	);
}
