import type { ActionResult } from "./types";

type AuthApiError = {
	error: string;
	fieldErrors?: Partial<Record<string, string[]>>;
};

type AuthApiSuccess = ActionResult & {
	success?: true;
};

export function toAuthActionResult(result: AuthApiSuccess | AuthApiError): ActionResult {
	if ("error" in result) {
		return {
			error: result.error,
			fieldErrors: result.fieldErrors,
		};
	}

	return result;
}
