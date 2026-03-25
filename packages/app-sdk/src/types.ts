export type FieldErrors = Partial<Record<string, string[]>>;

export type SdkError = {
	message: string;
	status?: number;
	fieldErrors?: FieldErrors;
};

export type SdkResult<T> = { ok: true; data: T } | { ok: false; error: SdkError };

export type AuthTokenStrategy = {
	getAuthHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
	onResponse?: (response: Response) => Promise<void> | void;
};

export type SdkClientConfig = {
	baseUrl: string;
	fetchFn?: typeof fetch;
	auth?: AuthTokenStrategy;
};

export type MutationSuccess = { success: true };
