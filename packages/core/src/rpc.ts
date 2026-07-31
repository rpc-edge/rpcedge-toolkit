import { RpcEdgeError, mapFetchError } from "./errors.js";
import { authHeaders } from "./config.js";
import { hostOf } from "./endpoints.js";

export interface RpcCallOptions {
  url: string;
  method: string;
  params?: unknown[];
  timeoutMs?: number;
  /** Optional API key sent as headers (in addition to any ?key= in URL). */
  apiKey?: string;
  id?: number | string;
}

export interface RpcResult<T> {
  result: T;
  latencyMs: number;
  host: string;
}

export async function rpcCall<T>(opts: RpcCallOptions): Promise<RpcResult<T>> {
  const {
    url,
    method,
    params = [],
    timeoutMs = 8000,
    apiKey,
    id = 1,
  } = opts;

  const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...authHeaders(apiKey),
    };
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    const latencyMs = Math.round((performance.now() - started) * 10) / 10;

    if (resp.status === 401 || resp.status === 403) {
      throw new RpcEdgeError("auth", `${method}: HTTP ${resp.status} unauthorized`, {
        nextAction: "Check RPCEDGE_KEY / config key and that the plan is active at https://app.rpcedge.com",
      });
    }
    if (resp.status === 429) {
      throw new RpcEdgeError("quota", `${method}: HTTP 429 rate limited or quota exceeded`, {
        nextAction: "Back off, reduce RPS, or upgrade plan / check bandwidth allowance.",
      });
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new RpcEdgeError("upstream", `${method}: HTTP ${resp.status}${text ? ` - ${text.slice(0, 200)}` : ""}`, {
        nextAction: "Retry; if persistent, check status and endpoint region.",
      });
    }

    const json = (await resp.json()) as {
      result?: T;
      error?: { code?: number; message?: string };
    };

    if (json.error) {
      const m = json.error.message ?? "RPC error";
      const code =
        /unauthorized|api key|forbidden|invalid key/i.test(m) ? "auth" :
        /limit|quota|rate/i.test(m) ? "quota" :
        "upstream";
      throw new RpcEdgeError(code as "auth" | "quota" | "upstream", `${method}: ${m}`, {
        nextAction:
          code === "auth"
            ? "Verify the API key and auth style (?key=, x-api-key, or Bearer)."
            : undefined,
      });
    }
    if (json.result === undefined) {
      throw new RpcEdgeError("upstream", `${method}: no result in response`);
    }

    return { result: json.result, latencyMs, host: hostOf(url) };
  } catch (e) {
    if (e instanceof RpcEdgeError) throw e;
    throw mapFetchError(e, method);
  } finally {
    clearTimeout(timer);
  }
}
