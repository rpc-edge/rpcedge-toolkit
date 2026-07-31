/** Stable error codes for SDK / CLI / MCP consumers. */
export type RpcEdgeErrorCode =
  | "auth"
  | "config"
  | "quota"
  | "timeout"
  | "network"
  | "upstream"
  | "invalid_argument"
  | "unknown";

export class RpcEdgeError extends Error {
  readonly code: RpcEdgeErrorCode;
  readonly causeDetail?: unknown;
  readonly nextAction?: string;

  constructor(
    code: RpcEdgeErrorCode,
    message: string,
    opts?: { cause?: unknown; nextAction?: string },
  ) {
    super(message);
    this.name = "RpcEdgeError";
    this.code = code;
    this.causeDetail = opts?.cause;
    this.nextAction = opts?.nextAction;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      nextAction: this.nextAction,
    };
  }
}

export function mapFetchError(err: unknown, method?: string): RpcEdgeError {
  if (err instanceof RpcEdgeError) return err;
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : String(err);
  const prefix = method ? `${method}: ` : "";

  if (name === "AbortError" || /aborted|timeout/i.test(msg)) {
    return new RpcEdgeError("timeout", `${prefix}request timed out`, {
      cause: err,
      nextAction: "Retry, increase timeout, or check network path to the endpoint.",
    });
  }
  if (/ECONNREFUSED|ENOTFOUND|fetch failed|network/i.test(msg)) {
    return new RpcEdgeError("network", `${prefix}${msg}`, {
      cause: err,
      nextAction: "Check DNS, TLS, and that the host is reachable from this machine.",
    });
  }
  return new RpcEdgeError("unknown", `${prefix}${msg}`, { cause: err });
}
