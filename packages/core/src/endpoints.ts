/** Canonical product endpoints for rpc edge (mainnet, Frankfurt-pinned stack). */

export const DEFAULTS = {
  rpcBase: "https://rpc.rpcedge.com",
  wsBase: "wss://rpc.rpcedge.com",
  grpcHost: "grpc.rpcedge.com:443",
  relayBase: "https://relay.rpcedge.com",
  publicMainnet: "https://api.mainnet-beta.solana.com",
  docs: "https://docs.rpcedge.com",
  app: "https://app.rpcedge.com",
  signup: "https://app.rpcedge.com/signup",
  site: "https://rpcedge.com",
  skills: "https://rpcedge.com/skills.md",
} as const;

/** Host of a URL with credentials / query stripped (safe for logs and tool output). */
export function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return u.host || u.hostname;
  } catch {
    const noScheme = url.split("://")[1] ?? url;
    return noScheme.split(/[/?#]/)[0] ?? noScheme;
  }
}

/** Redact any `key=` / API-key-looking query values for display. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has("key")) u.searchParams.set("key", "***");
    if (u.searchParams.has("api-key")) u.searchParams.set("api-key", "***");
    if (u.searchParams.has("api_key")) u.searchParams.set("api_key", "***");
    return u.toString();
  } catch {
    return hostOf(url);
  }
}

export function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return "***";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

/** Build HTTP RPC URL with optional key query param. */
export function buildRpcUrl(base: string, apiKey?: string): string {
  const b = base.replace(/\/$/, "");
  if (!apiKey) return b;
  try {
    const u = new URL(b);
    if (!u.searchParams.has("key")) u.searchParams.set("key", apiKey);
    return u.toString();
  } catch {
    const sep = b.includes("?") ? "&" : "?";
    return `${b}${sep}key=${encodeURIComponent(apiKey)}`;
  }
}

export function buildWsUrl(base: string, apiKey?: string): string {
  return buildRpcUrl(base, apiKey).replace(/^http/, "ws");
}
