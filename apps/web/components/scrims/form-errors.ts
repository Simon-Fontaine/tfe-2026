export type FormFieldErrors = Partial<Record<string, string[]>>;

type ApiPayload<T> = {
	data?: T;
	error?: string;
	fieldErrors?: FormFieldErrors;
};

export function getFieldErrorText(fieldErrors: FormFieldErrors, field: string) {
	return fieldErrors[field]?.join(" ");
}

export async function readApiPayload<T>(response: Response): Promise<ApiPayload<T>> {
	const payload = (await response.json().catch(() => null)) as ApiPayload<T> | null;
	if (!payload || typeof payload !== "object") {
		return response.ok ? {} : { error: `Request failed (${response.status}).` };
	}

	return {
		data: payload.data,
		error: typeof payload.error === "string" ? payload.error : undefined,
		fieldErrors:
			payload.fieldErrors && typeof payload.fieldErrors === "object"
				? payload.fieldErrors
				: undefined,
	};
}
