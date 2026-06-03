export function requiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required.`);
	}
	return value;
}

export function requiredNumberEnv(name: string): number {
	const value = requiredEnv(name);
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new Error(`${name} must be a finite number.`);
	}
	return parsed;
}
