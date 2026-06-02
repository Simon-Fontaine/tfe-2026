"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScrimDetailTab } from "@/lib/scrims/view-model";

interface ScrimDetailTabsProps {
	defaultTab: ScrimDetailTab;
	showResult: boolean;
	showConfirmations: boolean;
	overview: ReactNode;
	result: ReactNode;
	confirmations: ReactNode;
	activity: ReactNode;
}

export function ScrimDetailTabs({
	defaultTab,
	showResult,
	showConfirmations,
	overview,
	result,
	confirmations,
	activity,
}: ScrimDetailTabsProps) {
	const resolvedDefault: ScrimDetailTab =
		(defaultTab === "result" && !showResult) ||
		(defaultTab === "confirmations" && !showConfirmations)
			? "overview"
			: defaultTab;

	return (
		<Tabs defaultValue={resolvedDefault} className="gap-4">
			<TabsList className="h-9">
				<TabsTrigger value="overview" className="px-3 text-xs">
					Overview
				</TabsTrigger>
				{showResult ? (
					<TabsTrigger value="result" className="px-3 text-xs">
						Result &amp; evidence
					</TabsTrigger>
				) : null}
				{showConfirmations ? (
					<TabsTrigger value="confirmations" className="px-3 text-xs">
						Confirmations
					</TabsTrigger>
				) : null}
				<TabsTrigger value="activity" className="px-3 text-xs">
					Activity
				</TabsTrigger>
			</TabsList>

			<TabsContent value="overview">{overview}</TabsContent>
			{showResult ? <TabsContent value="result">{result}</TabsContent> : null}
			{showConfirmations ? <TabsContent value="confirmations">{confirmations}</TabsContent> : null}
			<TabsContent value="activity">{activity}</TabsContent>
		</Tabs>
	);
}
