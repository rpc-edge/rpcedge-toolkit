/**
 * rpcedge-sdk - TypeScript client for rpc edge Solana infrastructure.
 *
 * @example
 * ```ts
 * import { RpcEdge } from "rpcedge-sdk";
 *
 * const edge = await RpcEdge.fromEnv();
 * console.log(await edge.getSlot());
 * const h = await edge.health();
 * console.log(h.summary);
 * ```
 */

import {
  DEFAULTS,
  resolveConfig,
  rpcCall,
  health,
  priorityFees,
  epochInfo,
  nextLeaders,
  doctor,
  submitViaRelay,
  submitViaRpc,
  authHeaders,
  buildRpcUrl,
  buildWsUrl,
  type ResolvedConfig,
  type ResolveOptions,
  type HealthReport,
  type FeeReport,
  type EpochReport,
  type LeadersReport,
  type DoctorReport,
  type SubmitResult,
  RpcEdgeError,
} from "rpcedge-core";

export {
  DEFAULTS,
  RpcEdgeError,
  resolveConfig,
  buildRpcUrl,
  buildWsUrl,
  authHeaders,
  type ResolvedConfig,
  type HealthReport,
  type FeeReport,
  type EpochReport,
  type LeadersReport,
  type DoctorReport,
  type SubmitResult,
} from "rpcedge-core";

export interface RpcEdgeOptions extends ResolveOptions {
  /** Commitment for helpers that take it (documentation default: processed). */
  commitment?: "processed" | "confirmed" | "finalized";
}

export class RpcEdge {
  readonly config: ResolvedConfig;
  readonly commitment: "processed" | "confirmed" | "finalized";

  private constructor(config: ResolvedConfig, commitment: RpcEdgeOptions["commitment"] = "processed") {
    this.config = config;
    this.commitment = commitment ?? "processed";
  }

  /** Resolve from env / config file (async because config is on disk). */
  static async fromEnv(opts: RpcEdgeOptions = {}): Promise<RpcEdge> {
    const config = await resolveConfig(opts);
    return new RpcEdge(config, opts.commitment);
  }

  /** Construct from an already-resolved config (sync). */
  static fromConfig(config: ResolvedConfig, opts: Pick<RpcEdgeOptions, "commitment"> = {}): RpcEdge {
    return new RpcEdge(config, opts.commitment);
  }

  /** Construct with an explicit API key (rpc edge production path). */
  static withKey(apiKey: string, opts: RpcEdgeOptions = {}): RpcEdge {
    const key = apiKey.trim();
    if (!key) {
      throw new RpcEdgeError("config", "api key is empty", {
        nextAction: "Pass a UUID key from https://app.rpcedge.com",
      });
    }
    const rpcBase = opts.rpcUrl ?? process.env.RPCEDGE_RPC_URL?.trim() ?? DEFAULTS.rpcBase;
    const rpcUrl = opts.rpcUrl?.includes("key=") ? opts.rpcUrl : buildRpcUrl(rpcBase.replace(/\?.*$/, ""), key);
    const wsUrl = process.env.SOLANA_WS_URL?.trim() || buildWsUrl(DEFAULTS.wsBase, key);
    const config: ResolvedConfig = {
      apiKey: key,
      rpcUrl,
      wsUrl,
      relayBase: (process.env.RPCEDGE_RELAY_URL?.trim() || DEFAULTS.relayBase).replace(/\/$/, ""),
      grpcHost: process.env.YELLOWSTONE_GRPC_URL?.trim() || DEFAULTS.grpcHost,
      label: "rpc.rpcedge.com",
      keySource: "env:RPCEDGE_KEY",
      configPath: "",
    };
    return new RpcEdge(config, opts.commitment);
  }

  /** HTTP JSON-RPC URL (may include ?key=). */
  get rpcUrl(): string {
    return this.config.rpcUrl;
  }

  /** WebSocket URL for subscriptions. */
  get wsUrl(): string {
    return this.config.wsUrl;
  }

  /** Yellowstone gRPC host:port (use with x-api-key metadata). */
  get grpcHost(): string {
    return this.config.grpcHost;
  }

  /** Headers for gRPC metadata / relay (do not log). */
  get grpcMetadata(): Record<string, string> {
    return authHeaders(this.config.apiKey);
  }

  /**
   * Build a `@solana/web3.js` Connection when that peer dependency is installed.
   * Dynamic import so the SDK works without web3.js for raw RPC use.
   */
  async connection(opts?: {
    commitment?: "processed" | "confirmed" | "finalized";
    wsEndpoint?: string;
  }): Promise<import("@solana/web3.js").Connection> {
    let Connection: typeof import("@solana/web3.js").Connection;
    try {
      ({ Connection } = await import("@solana/web3.js"));
    } catch {
      throw new RpcEdgeError("config", "@solana/web3.js is not installed", {
        nextAction: "pnpm add @solana/web3.js  (optional peer of rpcedge-sdk)",
      });
    }
    return new Connection(this.config.rpcUrl, {
      commitment: opts?.commitment ?? this.commitment,
      wsEndpoint: opts?.wsEndpoint ?? this.config.wsUrl,
    });
  }

  /** Low-level JSON-RPC call. */
  async call<T>(method: string, params: unknown[] = [], timeoutMs = 8000): Promise<T> {
    const r = await rpcCall<T>({
      url: this.config.rpcUrl,
      method,
      params,
      apiKey: this.config.apiKey,
      timeoutMs,
    });
    return r.result;
  }

  async getSlot(commitment?: "processed" | "confirmed" | "finalized"): Promise<number> {
    const c = commitment ?? this.commitment;
    return this.call<number>("getSlot", [{ commitment: c }]);
  }

  async health(): Promise<HealthReport> {
    return health(this.config);
  }

  async priorityFees(): Promise<FeeReport> {
    return priorityFees(this.config);
  }

  async epochInfo(): Promise<EpochReport> {
    return epochInfo(this.config);
  }

  async nextLeaders(count = 8): Promise<LeadersReport> {
    return nextLeaders(this.config, count);
  }

  async doctor(): Promise<DoctorReport> {
    return doctor(this.config);
  }

  /**
   * Submit a fully signed base64 transaction via the rpc edge relay (fast path).
   * Falls back to standard RPC sendTransaction if `via: "rpc"`.
   * Never signs - pass a signed payload only.
   */
  async sendSignedTransaction(
    signedTxBase64: string,
    opts: { via?: "relay" | "rpc"; maxWaitMs?: number } = {},
  ): Promise<SubmitResult> {
    const via = opts.via ?? "relay";
    if (via === "rpc") {
      return submitViaRpc(this.config, signedTxBase64, opts.maxWaitMs);
    }
    return submitViaRelay(this.config, signedTxBase64, opts.maxWaitMs);
  }
}
