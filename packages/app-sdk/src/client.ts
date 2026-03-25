import { AuthService } from "./services/auth";
import { OrgsService } from "./services/orgs";
import { TeamsService } from "./services/teams";
import { Transport } from "./transport";
import type { SdkClientConfig } from "./types";

export function createAppSdk(config: SdkClientConfig) {
	const transport = new Transport(config);
	return {
		auth: new AuthService(transport),
		orgs: new OrgsService(transport),
		teams: new TeamsService(transport),
	};
}

export type AppSdk = ReturnType<typeof createAppSdk>;
