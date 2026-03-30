import { AuthService } from "./services/auth";
import { ChatService } from "./services/chat";
import { OrgsService } from "./services/orgs";
import { RecruitService } from "./services/recruit";
import { TeamsService } from "./services/teams";
import { Transport } from "./transport";
import type { SdkClientConfig } from "./types";

export function createAppSdk(config: SdkClientConfig) {
	const transport = new Transport(config);
	return {
		auth: new AuthService(transport),
		chat: new ChatService(transport),
		orgs: new OrgsService(transport),
		recruit: new RecruitService(transport),
		teams: new TeamsService(transport),
	};
}

export type AppSdk = ReturnType<typeof createAppSdk>;
