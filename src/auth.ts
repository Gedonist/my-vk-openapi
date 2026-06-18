import type { AppContext } from "./types";

export function readBearerToken(c: AppContext): string | null {
	const authorization = c.req.header("authorization") || "";
	const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
	return bearer || c.req.header("x-api-token") || c.req.query("token") || null;
}

export function isAuthorized(c: AppContext): boolean {
	const configuredToken = c.env.API_AUTH_TOKEN;
	const providedToken = readBearerToken(c);
	return Boolean(configuredToken && providedToken && providedToken === configuredToken);
}
