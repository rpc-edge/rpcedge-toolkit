import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { DEFAULTS, buildRpcUrl, buildWsUrl, hostOf } from "./endpoints.js";
import { RpcEdgeError } from "./errors.js";

export interface RpcEdgeConfigFile {
  apiKey?: string;
  rpcBase?: string;
  wsBase?: string;
  relayBase?: string;
  grpcHost?: string;
}

export interface ResolvedConfig {
  apiKey?: string;
  /** Fully resolved HTTP JSON-RPC URL (may include ?key=). */
  rpcUrl: string;
  /** Fully resolved WebSocket URL. */
  wsUrl: string;
  /** Relay base (no path). */
  relayBase: string;
  grpcHost: string;
  /** Safe label for logs (host only). */
  label: string;
  /** Where the key came from, for doctor. */
  keySource: "env:RPCEDGE_KEY" | "env:SOLANA_RPC_URL" | "config" | "none";
  configPath: string;
}

export function defaultConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  if (xdg) return join(xdg, "rpcedge", "config.json");
  return join(homedir(), ".config", "rpcedge", "config.json");
}

export async function readConfigFile(path = defaultConfigPath()): Promise<RpcEdgeConfigFile> {
  if (!existsSync(path)) return {};
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as RpcEdgeConfigFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    throw new RpcEdgeError("config", `failed to read config at ${path}`, {
      cause: e,
      nextAction: "Fix or delete the config file, then re-run `rpcedge config set-key`.",
    });
  }
}

export async function writeConfigFile(
  patch: RpcEdgeConfigFile,
  path = defaultConfigPath(),
): Promise<void> {
  const dir = join(path, "..");
  await mkdir(dir, { recursive: true });
  const existing = await readConfigFile(path);
  const next: RpcEdgeConfigFile = { ...existing, ...patch };
  // Drop empty strings
  for (const k of Object.keys(next) as (keyof RpcEdgeConfigFile)[]) {
    if (next[k] === "" || next[k] === undefined) delete next[k];
  }
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  try {
    await chmod(path, 0o600);
  } catch {
    /* best-effort on platforms without chmod */
  }
}

export interface ResolveOptions {
  /** Explicit API key (CLI flag). */
  apiKey?: string;
  /** Explicit full RPC URL override. */
  rpcUrl?: string;
  /** Skip reading the config file (tests). */
  skipConfigFile?: boolean;
  configPath?: string;
}

/**
 * Resolve endpoint + key from (highest wins):
 * 1. explicit options
 * 2. SOLANA_RPC_URL / RPCEDGE_RPC_URL env
 * 3. RPCEDGE_KEY env
 * 4. ~/.config/rpcedge/config.json
 * 5. public mainnet-beta (no key) as last-resort demo baseline
 */
export async function resolveConfig(opts: ResolveOptions = {}): Promise<ResolvedConfig> {
  const configPath = opts.configPath ?? defaultConfigPath();
  const file = opts.skipConfigFile ? {} : await readConfigFile(configPath);

  const rpcBase =
    process.env.RPCEDGE_RPC_URL?.trim() ||
    file.rpcBase ||
    DEFAULTS.rpcBase;
  const wsBase =
    process.env.RPCEDGE_WS_URL?.trim() ||
    file.wsBase ||
    DEFAULTS.wsBase;
  const relayBase = (
    process.env.RPCEDGE_RELAY_URL?.trim() ||
    file.relayBase ||
    DEFAULTS.relayBase
  ).replace(/\/$/, "");
  const grpcHost =
    process.env.YELLOWSTONE_GRPC_URL?.trim() ||
    process.env.RPCEDGE_GRPC_HOST?.trim() ||
    file.grpcHost ||
    DEFAULTS.grpcHost;

  // Explicit full URL
  if (opts.rpcUrl?.trim()) {
    const rpcUrl = opts.rpcUrl.trim();
    return {
      apiKey: opts.apiKey ?? extractKeyFromUrl(rpcUrl) ?? file.apiKey,
      rpcUrl,
      wsUrl: process.env.SOLANA_WS_URL?.trim() || deriveWs(rpcUrl),
      relayBase,
      grpcHost,
      label: hostOf(rpcUrl),
      keySource: opts.apiKey ? "env:RPCEDGE_KEY" : process.env.SOLANA_RPC_URL ? "env:SOLANA_RPC_URL" : "config",
      configPath,
    };
  }

  if (process.env.SOLANA_RPC_URL?.trim()) {
    const rpcUrl = process.env.SOLANA_RPC_URL.trim();
    return {
      apiKey: opts.apiKey ?? process.env.RPCEDGE_KEY?.trim() ?? extractKeyFromUrl(rpcUrl) ?? file.apiKey,
      rpcUrl,
      wsUrl: process.env.SOLANA_WS_URL?.trim() || deriveWs(rpcUrl),
      relayBase,
      grpcHost,
      label: hostOf(rpcUrl),
      keySource: "env:SOLANA_RPC_URL",
      configPath,
    };
  }

  const apiKey =
    opts.apiKey?.trim() ||
    process.env.RPCEDGE_KEY?.trim() ||
    file.apiKey?.trim() ||
    undefined;

  const keySource: ResolvedConfig["keySource"] = opts.apiKey?.trim() || process.env.RPCEDGE_KEY?.trim()
    ? "env:RPCEDGE_KEY"
    : file.apiKey
      ? "config"
      : "none";

  if (apiKey) {
    const rpcUrl = buildRpcUrl(rpcBase, apiKey);
    const wsUrl = process.env.SOLANA_WS_URL?.trim() || buildWsUrl(wsBase, apiKey);
    return {
      apiKey,
      rpcUrl,
      wsUrl,
      relayBase,
      grpcHost,
      label: hostOf(rpcBase),
      keySource,
      configPath,
    };
  }

  // Demo baseline - public RPC (no key). Production paths should set a key.
  return {
    rpcUrl: DEFAULTS.publicMainnet,
    wsUrl: "wss://api.mainnet-beta.solana.com",
    relayBase,
    grpcHost,
    label: hostOf(DEFAULTS.publicMainnet),
    keySource: "none",
    configPath,
  };
}

function extractKeyFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.searchParams.get("key") ?? u.searchParams.get("api-key") ?? undefined;
  } catch {
    return undefined;
  }
}

function deriveWs(httpUrl: string): string {
  try {
    const u = new URL(httpUrl);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return u.toString();
  } catch {
    return httpUrl.replace(/^http/, "ws");
  }
}

/** Auth headers for gRPC metadata / relay (never log these). */
export function authHeaders(apiKey?: string): Record<string, string> {
  if (!apiKey) return {};
  return {
    "x-api-key": apiKey,
    authorization: `Bearer ${apiKey}`,
  };
}
