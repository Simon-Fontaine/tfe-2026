import type * as v from "valibot";

export function extractErrors(issues: v.BaseIssue<unknown>[]): Partial<Record<string, string[]>> {
	const result: Partial<Record<string, string[]>> = {};
	for (const issue of issues) {
		const key = issue.path?.map((p) => String(p.key)).join(".") ?? "root";
		if (!result[key]) result[key] = [];
		(result[key] as string[]).push(issue.message);
	}
	return result;
}
