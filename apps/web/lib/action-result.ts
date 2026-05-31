export type BasicActionResult = {
	error?: string;
	fieldErrors?: Partial<Record<string, string[]>>;
};

export type ApiMutationError = {
	error: string;
	fieldErrors?: Partial<Record<string, string[]>>;
	status: number;
};

export type ApiMutationSuccess<T extends Record<string, unknown> = Record<string, never>> = {
	success: true;
} & T;

export function isApiActionError(result: unknown): result is ApiMutationError {
	return typeof result === "object" && result !== null && "error" in result;
}

export function toFormActionError(result: ApiMutationError): BasicActionResult {
	return {
		error: result.error,
		fieldErrors: result.fieldErrors,
	};
}
