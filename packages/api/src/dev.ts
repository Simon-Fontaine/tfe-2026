const api = Bun.spawn(["bun", "--watch", "src/index.ts"], {
	stdout: "inherit",
	stderr: "inherit",
	stdin: "inherit",
});

const worker = Bun.spawn(["bun", "--watch", "src/worker/index.ts"], {
	stdout: "inherit",
	stderr: "inherit",
	stdin: "inherit",
});

process.on("SIGINT", () => {
	api.kill();
	worker.kill();
});

process.on("SIGTERM", () => {
	api.kill();
	worker.kill();
});

await Promise.all([api.exited, worker.exited]);
