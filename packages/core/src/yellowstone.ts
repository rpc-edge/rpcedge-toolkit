/**
 * Time-boxed Yellowstone gRPC sample (request/response-friendly for MCP/CLI).
 * Optional dependency: @triton-one/yellowstone-grpc (bundled by rpcedge-mcp / rpcedge CLI).
 */

import type { ResolvedConfig } from "./config.js";
import { RpcEdgeError, mapFetchError } from "./errors.js";

export interface YellowstoneSampleOptions {
  /** How long to listen (ms). Clamped 500–15_000. Default 3000. */
  durationMs?: number;
  /** Stop after this many stream messages. Clamped 1–50. Default 8. */
  maxMessages?: number;
}

export interface YellowstoneSampleReport {
  host: string;
  ok: boolean;
  messages: number;
  durationMs: number;
  firstMessageMs: number | null;
  samples: string[];
  summary: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function grpcHttpsEndpoint(grpcHost: string): string {
  // Client expects https://host:port
  if (grpcHost.startsWith("http://") || grpcHost.startsWith("https://")) return grpcHost;
  return `https://${grpcHost}`;
}

function summarizeUpdate(data: unknown): string {
  if (!data || typeof data !== "object") return typeof data;
  const d = data as Record<string, unknown>;
  if (d.slot) {
    const s = d.slot as { slot?: string | number; parent?: string | number };
    return `slot ${s.slot ?? "?"}${s.parent != null ? ` parent=${s.parent}` : ""}`;
  }
  if (d.transaction) return "transaction update";
  if (d.account) return "account update";
  if (d.block) return "block update";
  if (d.ping) return "ping";
  if (d.pong) return "pong";
  const keys = Object.keys(d).filter((k) => d[k] != null && k !== "filters");
  return keys.length ? keys.slice(0, 4).join(",") : "update";
}

/**
 * Open a short Yellowstone slot subscription, collect a few updates, then close.
 * Requires an API key for rpc edge production gRPC.
 */
export async function yellowstoneSample(
  cfg: ResolvedConfig,
  opts: YellowstoneSampleOptions = {},
): Promise<YellowstoneSampleReport> {
  if (!cfg.apiKey && cfg.label.includes("rpcedge")) {
    throw new RpcEdgeError("auth", "yellowstone_sample requires an API key for rpc edge gRPC", {
      nextAction: "Set RPCEDGE_KEY or pass a key-bearing SOLANA_RPC_URL, then retry.",
    });
  }

  const durationMs = clamp(opts.durationMs ?? 3000, 500, 15_000);
  const maxMessages = clamp(opts.maxMessages ?? 8, 1, 50);

  type YsStream = {
    on: (ev: string, cb: (data: unknown) => void) => void;
    write: (req: unknown) => void;
    end?: () => void;
    destroy?: () => void;
    cancel?: () => void;
  };

  let ClientCtor: new (
    endpoint: string,
    xToken: string | undefined,
    channelOptions: unknown,
  ) => { subscribe: () => Promise<YsStream> };
  let commitmentProcessed: number;

  try {
    const mod = (await import("@triton-one/yellowstone-grpc")) as unknown as {
      default: typeof ClientCtor;
      CommitmentLevel: { PROCESSED: number };
    };
    ClientCtor = mod.default;
    commitmentProcessed = mod.CommitmentLevel.PROCESSED;
  } catch (e) {
    throw new RpcEdgeError(
      "config",
      "yellowstone sample needs @triton-one/yellowstone-grpc",
      {
        cause: e,
        nextAction: "Use rpcedge-mcp / the rpcedge CLI (includes the client), or pnpm add @triton-one/yellowstone-grpc",
      },
    );
  }

  const endpoint = grpcHttpsEndpoint(cfg.grpcHost);
  const host = cfg.grpcHost.replace(/^https?:\/\//, "");
  const started = Date.now();
  let firstMessageMs: number | null = null;
  let messages = 0;
  const samples: string[] = [];

  try {
    const client = new ClientCtor(endpoint, cfg.apiKey, undefined);
    const stream = await client.subscribe();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          stream.end?.();
          stream.destroy?.();
          stream.cancel?.();
        } catch {
          /* ignore close races */
        }
        resolve();
      };

      const timer = setTimeout(finish, durationMs);

      stream.on("data", (data: unknown) => {
        messages += 1;
        if (firstMessageMs == null) firstMessageMs = Date.now() - started;
        if (samples.length < 5) samples.push(summarizeUpdate(data));
        if (messages >= maxMessages) {
          clearTimeout(timer);
          finish();
        }
      });

      stream.on("error", (err: unknown) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      // Light probe: slots only (no heavy account/tx fan-in)
      stream.write({
        accounts: {},
        slots: { client: { filterByCommitment: true } },
        transactions: {},
        transactionsStatus: {},
        blocks: {},
        blocksMeta: {},
        entry: {},
        accountsDataSlice: [],
        commitment: commitmentProcessed,
      });
    });
  } catch (e) {
    if (e instanceof RpcEdgeError) throw e;
    throw mapFetchError(e, "yellowstone_sample");
  }

  const elapsed = Date.now() - started;
  const ok = messages > 0;
  const summary = [
    `${host}: yellowstone sample ${ok ? "OK" : "NO MESSAGES"}`,
    `  duration ${elapsed} ms (cap ${durationMs} ms) · messages ${messages}${maxMessages ? ` (stop at ${maxMessages})` : ""}`,
    firstMessageMs != null
      ? `  first message after ${firstMessageMs} ms (this host → ${host})`
      : `  no stream messages (check key, plan gRPC access, and firewall)`,
    samples.length ? `  samples: ${samples.join("; ")}` : "  samples: —",
    `  note: time-boxed probe only - not a live subscription; for production use a Yellowstone client with narrow filters.`,
    `  co-located first-seen races: run solbench with --features grpc on the edge.`,
  ].join("\n");

  return {
    host,
    ok,
    messages,
    durationMs: elapsed,
    firstMessageMs,
    samples,
    summary,
  };
}
