/**
 * Environment for the `rpcedge mcp` child process.
 *
 * The MCP server runs under an agent host, so it must not inherit wallet
 * paths, private keys, cloud tokens, or anything else that happens to be in
 * the parent shell. Only the variables the server actually reads (see
 * rpcedge-core config.ts) plus terminal and platform basics are forwarded.
 */

/** Process basics on every platform. */
const BASE_KEYS = ["PATH", "HOME", "TERM", "NO_COLOR", "FORCE_COLOR", "XDG_CONFIG_HOME"] as const;

/**
 * Network connectivity settings (proxies, corporate CA bundle). They carry no
 * wallet or API secrets of their own, and without them the server cannot reach
 * RPC endpoints from behind a proxy.
 */
const NETWORK_KEYS = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "NO_PROXY",
  "no_proxy",
  "NODE_EXTRA_CA_CERTS",
] as const;

/** Variables read by rpcedge-core resolveConfig / defaultConfigPath. */
const RPCEDGE_KEYS = [
  "RPCEDGE_KEY",
  "RPCEDGE_RPC_URL",
  "RPCEDGE_WS_URL",
  "RPCEDGE_RELAY_URL",
  "RPCEDGE_GRPC_HOST",
  "YELLOWSTONE_GRPC_URL",
  "SOLANA_RPC_URL",
  "SOLANA_WS_URL",
] as const;

/** Windows needs these for os.homedir(), temp dirs, and child resolution. */
const WIN32_KEYS = [
  "SystemRoot",
  "SystemDrive",
  "windir",
  "ComSpec",
  "PATHEXT",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "TEMP",
  "TMP",
] as const;

export const MCP_ENV_ALLOWLIST: readonly string[] = [...BASE_KEYS, ...NETWORK_KEYS, ...RPCEDGE_KEYS];

export function buildMcpEnv(
  source: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const keys = platform === "win32" ? [...MCP_ENV_ALLOWLIST, ...WIN32_KEYS] : MCP_ENV_ALLOWLIST;
  const env: NodeJS.ProcessEnv = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}
