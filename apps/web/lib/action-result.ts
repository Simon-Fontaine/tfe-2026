import type { SdkResult } from "@scrimflow/app-sdk";

export type BasicActionResult = {
	error?: string;
	fieldErrors?: Partial<Record<string, string[]>>;
};

export function toActionResult<T>(result: SdkResult<T>): BasicActionResult | { data: T } {
	if (!result.ok) {
		return {
			error: result.error.message,
			fieldErrors: result.error.fieldErrors,
		};
	}

	return { data: result.data };
}
