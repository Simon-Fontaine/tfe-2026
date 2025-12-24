import type { Context } from "hono";
import { getConnInfo } from "hono/bun";

export interface ClientRequestInfo {
  ip: string;
  userAgent: string;
}

export function extractClientInfo(c: Context): ClientRequestInfo {
  const connInfo = getConnInfo(c);
  const forwardedFor = c.req.header("x-forwarded-for");

  const ipCandidate =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-real-ip") ??
    forwardedFor?.split(",")[0]?.trim() ??
    c.req.header("x-forwarded-for") ??
    connInfo.remote?.address ??
    "127.0.0.1";

  const ip = ipCandidate.trim();
  const userAgent = c.req.header("user-agent") || "";

  return { ip, userAgent };
}
