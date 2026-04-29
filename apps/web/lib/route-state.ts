export type WorkspaceRouteScope = "personal" | "org" | "team";

export interface RouteStateMissing {
	kind: "missing";
}

export interface RouteStateNoAccess {
	kind: "no-access";
}

export interface RouteStateWrongContext {
	kind: "wrong-context";
	scope: Exclude<WorkspaceRouteScope, "personal">;
	requestedId: string;
}

export type RouteStateUnavailable = RouteStateMissing | RouteStateNoAccess | RouteStateWrongContext;

export type RouteStateResult<T> = { kind: "success"; data: T } | RouteStateUnavailable;

export interface WorkspacePathContext {
	scope: WorkspaceRouteScope;
	activeOrgId: string | null;
	activeTeamId: string | null;
}

const TEAM_PATH_REGEX = /^\/app\/teams\/([^/]+)/;
const ORG_PATH_REGEX = /^\/app\/orgs\/([^/]+)/;

export function routeStateSuccess<T>(data: T): RouteStateResult<T> {
	return { kind: "success", data };
}

export function routeStateMissing(): RouteStateMissing {
	return { kind: "missing" };
}

export function routeStateNoAccess(): RouteStateNoAccess {
	return { kind: "no-access" };
}

export function routeStateWrongContext(
	scope: RouteStateWrongContext["scope"],
	requestedId: string
): RouteStateWrongContext {
	return { kind: "wrong-context", scope, requestedId };
}

export function getWorkspacePathContext(pathname: string): WorkspacePathContext {
	const teamMatch = pathname.match(TEAM_PATH_REGEX);
	if (teamMatch) {
		return {
			scope: "team",
			activeOrgId: null,
			activeTeamId: teamMatch[1] ?? null,
		};
	}

	const orgMatch = pathname.match(ORG_PATH_REGEX);
	if (orgMatch) {
		return {
			scope: "org",
			activeOrgId: orgMatch[1] ?? null,
			activeTeamId: null,
		};
	}

	return {
		scope: "personal",
		activeOrgId: null,
		activeTeamId: null,
	};
}
