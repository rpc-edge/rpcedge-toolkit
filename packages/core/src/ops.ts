import { rpcCall } from "./rpc.js";
import type { ResolvedConfig } from "./config.js";
import { hostOf, redactUrl } from "./endpoints.js";
import { authHeaders } from "./config.js";
import { RpcEdgeError, mapFetchError } from "./errors.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function percentile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil(q * sortedAsc.length) - 1),
  );
  return sortedAsc[idx]!;
}

export interface HealthReport {
  host: string;
  healthy: boolean;
  solanaCore: string;
  slot: number;
  latencyMs: number;
  /** Human-readable multi-line summary. */
  summary: string;
}

export async function health(cfg: ResolvedConfig, timeoutMs = 8000): Promise<HealthReport> {
  const slot = await rpcCall<number>({
    url: cfg.rpcUrl,
    method: "getSlot",
    apiKey: cfg.apiKey,
    timeoutMs,
  });
  let solanaCore = "unknown";
  try {
    const v = await rpcCall<{ "solana-core"?: string }>({
      url: cfg.rpcUrl,
      method: "getVersion",
      apiKey: cfg.apiKey,
      timeoutMs,
    });
    solanaCore = v.result["solana-core"] ?? "unknown";
  } catch {
    /* optional */
  }
  const summary = [
    `${cfg.label}: healthy`,
    `  solana-core ${solanaCore}`,
    `  slot ${slot.result}`,
    `  getSlot latency ${slot.latencyMs} ms (single request, from this host)`,
  ].join("\n");
  return {
    host: cfg.label,
    healthy: true,
    solanaCore,
    slot: slot.result,
    latencyMs: slot.latencyMs,
    summary,
  };
}

export interface FeeReport {
  host: string;
  samples: number;
  nonZero: number;
  p50: number;
  p75: number;
  p90: number;
  max: number;
  summary: string;
}

export async function priorityFees(cfg: ResolvedConfig): Promise<FeeReport> {
  const r = await rpcCall<Array<{ slot: number; prioritizationFee: number }>>({
    url: cfg.rpcUrl,
    method: "getRecentPrioritizationFees",
    params: [[]],
    apiKey: cfg.apiKey,
  });
  const fees = r.result.map((x) => x.prioritizationFee).sort((a, b) => a - b);
  if (fees.length === 0) {
    return {
      host: cfg.label,
      samples: 0,
      nonZero: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      max: 0,
      summary: `${cfg.label}: no recent prioritization fees returned`,
    };
  }
  const nonZero = fees.filter((f) => f > 0).length;
  const p50 = percentile(fees, 0.5);
  const p75 = percentile(fees, 0.75);
  const p90 = percentile(fees, 0.9);
  const max = fees[fees.length - 1]!;
  const summary = [
    `${cfg.label}: priority fees over the last ${fees.length} slots (micro-lamports/CU)`,
    `  p50 ${p50} · p75 ${p75} · p90 ${p90} · max ${max}`,
    `  ${nonZero}/${fees.length} slots had a non-zero floor`,
    `  tip: set compute-unit price near p75-p90 to land during congestion.`,
  ].join("\n");
  return { host: cfg.label, samples: fees.length, nonZero, p50, p75, p90, max, summary };
}

export interface EpochReport {
  host: string;
  epoch: number;
  slotIndex: number;
  slotsInEpoch: number;
  absoluteSlot: number;
  blockHeight: number;
  pctThrough: number;
  summary: string;
}

export async function epochInfo(cfg: ResolvedConfig): Promise<EpochReport> {
  const r = await rpcCall<{
    epoch: number;
    slotIndex: number;
    slotsInEpoch: number;
    absoluteSlot: number;
    blockHeight: number;
  }>({
    url: cfg.rpcUrl,
    method: "getEpochInfo",
    apiKey: cfg.apiKey,
  });
  const e = r.result;
  const pctThrough = Math.round((e.slotIndex / e.slotsInEpoch) * 1000) / 10;
  const summary = [
    `${cfg.label}: epoch ${e.epoch} (${pctThrough}% through)`,
    `  slot ${e.absoluteSlot} · slot ${e.slotIndex}/${e.slotsInEpoch} in epoch`,
    `  block height ${e.blockHeight}`,
  ].join("\n");
  return { host: cfg.label, ...e, pctThrough, summary };
}

export interface LeadersReport {
  host: string;
  fromSlot: number;
  leaders: string[];
  summary: string;
}

export async function nextLeaders(cfg: ResolvedConfig, count = 8): Promise<LeadersReport> {
  const n = Math.min(Math.max(count, 1), 20);
  const slot = await rpcCall<number>({
    url: cfg.rpcUrl,
    method: "getSlot",
    apiKey: cfg.apiKey,
  });
  const leaders = await rpcCall<string[]>({
    url: cfg.rpcUrl,
    method: "getSlotLeaders",
    params: [slot.result, n],
    apiKey: cfg.apiKey,
  });
  const lines = leaders.result.map((id, i) => `  slot ${slot.result + i}  ${id}`);
  const summary = [
    `${cfg.label}: next ${leaders.result.length} slot leaders (from slot ${slot.result})`,
    ...lines,
  ].join("\n");
  return {
    host: cfg.label,
    fromSlot: slot.result,
    leaders: leaders.result,
    summary,
  };
}

export interface LatencyRow {
  host: string;
  p50Ms: number | null;
  ok: number;
  samples: number;
  errors: number;
  lastSlot: number;
}

export interface LatencyCompareReport {
  rows: LatencyRow[];
  summary: string;
}

/** getSlot read latency from THIS host - network-inclusive, not a landing proxy. */
export async function latencyCompare(
  urls: string[],
  samples = 8,
  apiKey?: string,
): Promise<LatencyCompareReport> {
  const n = Math.min(Math.max(samples, 1), 25);
  const rows: LatencyRow[] = [];
  const lines: string[] = [];

  for (const url of urls) {
    const lat: number[] = [];
    let lastSlot = 0;
    let errors = 0;
    for (let i = 0; i < n; i++) {
      try {
        const r = await rpcCall<number>({
          url,
          method: "getSlot",
          apiKey,
          timeoutMs: 6000,
        });
        lat.push(r.latencyMs);
        lastSlot = r.result;
      } catch {
        errors++;
      }
      await sleep(40);
    }
    lat.sort((a, b) => a - b);
    const p50 = lat.length ? percentile(lat, 0.5) : null;
    const host = hostOf(url);
    rows.push({
      host,
      p50Ms: p50,
      ok: lat.length,
      samples: n,
      errors,
      lastSlot,
    });
    lines.push(
      `  ${host.padEnd(30)} p50 ${p50 == null ? "—" : `${p50} ms`}  (${lat.length}/${n} ok${errors ? `, ${errors} err` : ""}, slot ${lastSlot})`,
    );
  }

  const summary = [
    "getSlot read latency from THIS host (network-inclusive, not a landing/first-seen proxy):",
    ...lines,
    "  for infra-reflecting metrics (gRPC first-seen, landing), run solbench co-located: https://github.com/rpc-edge/solbench",
  ].join("\n");

  return { rows, summary };
}

export interface SubmitResult {
  host: string;
  signature: string;
  accepted: boolean;
  landed: boolean;
  confirmationStatus?: string;
  slot?: number;
  err?: unknown;
  elapsedMs: number;
  summary: string;
  via: "rpc" | "relay";
}

/** Submit a CALLER-SIGNED base64 tx via normal JSON-RPC sendTransaction and wait for confirm. */
export async function submitViaRpc(
  cfg: ResolvedConfig,
  signedTxBase64: string,
  maxWaitMs = 30_000,
): Promise<SubmitResult> {
  const wait = Math.min(Math.max(maxWaitMs, 1000), 90_000);
  const send = await rpcCall<string>({
    url: cfg.rpcUrl,
    method: "sendTransaction",
    params: [signedTxBase64, { encoding: "base64", skipPreflight: false, maxRetries: 5 }],
    apiKey: cfg.apiKey,
    timeoutMs: 15_000,
  });
  return confirmLanding(cfg, send.result, wait, "rpc");
}

/**
 * Submit via rpc edge transaction sender relay (JSON-RPC compatibility path).
 * Keyless for signing: caller must pass a fully signed base64 transaction.
 */
export async function submitViaRelay(
  cfg: ResolvedConfig,
  signedTxBase64: string,
  maxWaitMs = 30_000,
): Promise<SubmitResult> {
  if (!cfg.apiKey) {
    throw new RpcEdgeError("auth", "relay submit requires an API key", {
      nextAction: "Set RPCEDGE_KEY or run `rpcedge config set-key <key>`.",
    });
  }
  const wait = Math.min(Math.max(maxWaitMs, 1000), 90_000);
  const url = `${cfg.relayBase}/v1/sendTransaction`;
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "sendTransaction",
    params: [signedTxBase64, { encoding: "base64" }],
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  const started = performance.now();
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders(cfg.apiKey),
      },
      body,
      signal: controller.signal,
    });
    if (resp.status === 401 || resp.status === 403) {
      throw new RpcEdgeError("auth", `relay: HTTP ${resp.status}`, {
        nextAction: "Check API key and plan access for the transaction sender.",
      });
    }
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new RpcEdgeError("upstream", `relay: HTTP ${resp.status} ${t.slice(0, 200)}`);
    }
    const json = (await resp.json()) as {
      result?: string;
      error?: { message?: string };
    };
    if (json.error) {
      throw new RpcEdgeError("upstream", `relay: ${json.error.message ?? "error"}`);
    }
    if (!json.result) {
      throw new RpcEdgeError("upstream", "relay: no signature in response");
    }
    void started;
    return confirmLanding(cfg, json.result, wait, "relay");
  } catch (e) {
    if (e instanceof RpcEdgeError) throw e;
    throw mapFetchError(e, "relay");
  } finally {
    clearTimeout(timer);
  }
}

async function confirmLanding(
  cfg: ResolvedConfig,
  sig: string,
  wait: number,
  via: "rpc" | "relay",
): Promise<SubmitResult> {
  const submitSlot = (
    await rpcCall<number>({
      url: cfg.rpcUrl,
      method: "getSlot",
      apiKey: cfg.apiKey,
    }).catch(() => ({ result: 0, latencyMs: 0, host: cfg.label }))
  ).result;

  const started = Date.now();
  while (Date.now() - started < wait) {
    const st = await rpcCall<{
      value: Array<null | { slot: number; confirmationStatus?: string; err: unknown }>;
    }>({
      url: cfg.rpcUrl,
      method: "getSignatureStatuses",
      params: [[sig], { searchTransactionHistory: true }],
      apiKey: cfg.apiKey,
    });
    const s = st.result.value[0];
    if (s && s.err != null) {
      const summary = `${cfg.label}: FAILED on-chain (${via})\n  signature ${sig}\n  err ${JSON.stringify(s.err)}`;
      return {
        host: cfg.label,
        signature: sig,
        accepted: true,
        landed: false,
        err: s.err,
        elapsedMs: Date.now() - started,
        summary,
        via,
      };
    }
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) {
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      const delta = submitSlot ? ` (+${s.slot - submitSlot} slots from submit)` : "";
      const summary = `${cfg.label}: LANDED (${s.confirmationStatus}, via ${via})\n  signature ${sig}\n  slot ${s.slot}${delta}\n  ${secs}s to confirm`;
      return {
        host: cfg.label,
        signature: sig,
        accepted: true,
        landed: true,
        confirmationStatus: s.confirmationStatus,
        slot: s.slot,
        elapsedMs: Date.now() - started,
        summary,
        via,
      };
    }
    await sleep(600);
  }
  const summary = `${cfg.label}: submitted via ${via} but NOT confirmed within ${wait / 1000}s\n  signature ${sig}\n  (it may still land - check the signature)`;
  return {
    host: cfg.label,
    signature: sig,
    accepted: true,
    landed: false,
    elapsedMs: wait,
    summary,
    via,
  };
}

export interface DoctorReport {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  summary: string;
  config: {
    label: string;
    keySource: string;
    rpcUrlRedacted: string;
    grpcHost: string;
    relayBase: string;
    hasKey: boolean;
  };
}

export async function doctor(cfg: ResolvedConfig): Promise<DoctorReport> {
  const checks: DoctorReport["checks"] = [];

  checks.push({
    name: "api_key",
    ok: Boolean(cfg.apiKey) || cfg.label.includes("mainnet-beta"),
    detail: cfg.apiKey
      ? `key present (source: ${cfg.keySource})`
      : "no key - using public baseline; set RPCEDGE_KEY for rpc edge production",
  });

  try {
    const h = await health(cfg);
    checks.push({
      name: "rpc_health",
      ok: true,
      detail: `slot ${h.slot}, getSlot ${h.latencyMs} ms, solana-core ${h.solanaCore}`,
    });
  } catch (e) {
    checks.push({
      name: "rpc_health",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  const ok = checks.every((c) => c.ok);
  const summary = [
    `rpcedge doctor: ${ok ? "OK" : "ISSUES"}`,
    `  endpoint ${cfg.label}`,
    `  rpc ${redactUrl(cfg.rpcUrl)}`,
    `  grpc ${cfg.grpcHost}`,
    `  relay ${cfg.relayBase}`,
    ...checks.map((c) => `  [${c.ok ? "ok" : "!!"}] ${c.name}: ${c.detail}`),
    ok ? "  next: wire @solana/web3.js via rpcedge-sdk or `rpcedge slot`" : "  fix failed checks, then re-run doctor",
  ].join("\n");

  return {
    ok,
    checks,
    summary,
    config: {
      label: cfg.label,
      keySource: cfg.keySource,
      rpcUrlRedacted: redactUrl(cfg.rpcUrl),
      grpcHost: cfg.grpcHost,
      relayBase: cfg.relayBase,
      hasKey: Boolean(cfg.apiKey),
    },
  };
}
