#!/usr/bin/env node
/**
 * rpcedge-mcp - branded MCP server for rpc edge Solana infrastructure.
 *
 * Defaults to RPCEDGE_KEY → https://rpc.rpcedge.com. Also accepts SOLANA_RPC_URL
 * for any provider. Keys are never logged (hosts only).
 *
 * Install:
 *   claude mcp add rpcedge -- npx rpcedge-mcp@latest
 *   export RPCEDGE_KEY=...
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  DEFAULTS,
  resolveConfig,
  health,
  priorityFees,
  epochInfo,
  nextLeaders,
  latencyCompare,
  submitViaRelay,
  submitViaRpc,
  doctor,
  yellowstoneSample,
  hostOf,
  type ResolvedConfig,
} from "rpcedge-core";

const VERSION = "0.1.2";

const server = new McpServer({
  name: "rpcedge-mcp",
  version: VERSION,
});

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const fail = (e: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: `error: ${e instanceof Error ? e.message : String(e)}`,
    },
  ],
  isError: true,
});

const urlArg = z
  .string()
  .url()
  .optional()
  .describe("RPC URL override (default: RPCEDGE_KEY → rpc.rpcedge.com, or SOLANA_RPC_URL)");

async function cfg(url?: string): Promise<ResolvedConfig> {
  return resolveConfig({ rpcUrl: url });
}

server.registerTool(
  "rpc_health",
  {
    title: "RPC health",
    description:
      "Health, solana-core version, current slot, and measured getSlot latency for the configured rpc edge (or override) endpoint.",
    inputSchema: { url: urlArg },
  },
  async ({ url }) => {
    try {
      return text((await health(await cfg(url))).summary);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "priority_fee_estimate",
  {
    title: "Priority fee estimate",
    description:
      "Recent prioritization-fee distribution (p50/p75/p90/max micro-lamports per CU) to price compute-unit fees for landing.",
    inputSchema: { url: urlArg },
  },
  async ({ url }) => {
    try {
      return text((await priorityFees(await cfg(url))).summary);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "epoch_info",
  {
    title: "Epoch info",
    description: "Current epoch, slot index / slots-in-epoch, absolute slot, and block height.",
    inputSchema: { url: urlArg },
  },
  async ({ url }) => {
    try {
      return text((await epochInfo(await cfg(url))).summary);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "next_leaders",
  {
    title: "Next slot leaders",
    description:
      "The next N slot leaders (validator identities) from the current slot - for timing transaction submission.",
    inputSchema: {
      url: urlArg,
      count: z.number().int().min(1).max(20).default(8),
    },
  },
  async ({ url, count }) => {
    try {
      return text((await nextLeaders(await cfg(url), count)).summary);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "latency_compare",
  {
    title: "Compare RPC latency",
    description:
      "getSlot read-latency (p50) across endpoints. Default: configured endpoint vs public mainnet-beta. Network-inclusive - not a landing/first-seen proxy. Use solbench co-located for infra metrics.",
    inputSchema: {
      urls: z.array(z.string().url()).optional(),
      samples: z.number().int().min(1).max(25).default(8),
    },
  },
  async ({ urls, samples }) => {
    try {
      const c = await resolveConfig();
      const list = urls && urls.length > 0 ? urls : [c.rpcUrl, DEFAULTS.publicMainnet];
      return text((await latencyCompare(list, samples, c.apiKey)).summary);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "submit_transaction",
  {
    title: "Submit transaction + confirm landing",
    description:
      "Relay a caller-SIGNED base64 transaction and confirm on-chain inclusion. Keyless for signing: the server never signs or holds keys. Default via=relay uses the rpc edge transaction sender; via=rpc uses standard sendTransaction.",
    inputSchema: {
      url: urlArg,
      signedTransaction: z.string().describe("Base64-encoded, fully signed transaction"),
      maxWaitMs: z.number().int().min(1000).max(90000).default(30000),
      via: z.enum(["relay", "rpc"]).default("relay"),
    },
  },
  async ({ url, signedTransaction, maxWaitMs, via }) => {
    try {
      const c = await cfg(url);
      const result =
        via === "rpc"
          ? await submitViaRpc(c, signedTransaction, maxWaitMs)
          : await submitViaRelay(c, signedTransaction, maxWaitMs);
      return text(result.summary);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "doctor",
  {
    title: "rpc edge doctor",
    description:
      "Check API key presence and RPC health; return fix-oriented guidance. Safe for agents (keys masked).",
    inputSchema: {},
  },
  async () => {
    try {
      return text((await doctor(await resolveConfig())).summary);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "endpoint_map",
  {
    title: "rpc edge endpoint map",
    description:
      "Return canonical rpc edge product endpoints and auth styles (no secrets). Use when wiring bots or explaining integration.",
    inputSchema: {},
  },
  async () => {
    const c = await resolveConfig();
    const body = [
      "rpc edge endpoint map (mainnet)",
      `  HTTP RPC     ${DEFAULTS.rpcBase}?key=YOUR_KEY`,
      `  WebSocket    ${DEFAULTS.wsBase}?key=YOUR_KEY`,
      `  gRPC         ${DEFAULTS.grpcHost}  (metadata: x-api-key or Bearer)`,
      `  Relay        ${DEFAULTS.relayBase}/v1/sendTransaction  (x-api-key / Bearer)`,
      `  Auth         ?key= query, or x-api-key / Authorization: Bearer`,
      `  Signup       ${DEFAULTS.signup}`,
      `  Skills       ${DEFAULTS.skills}`,
      `  Docs         ${DEFAULTS.docs}`,
      "",
      `Configured now: host=${c.label} keySource=${c.keySource} hasKey=${Boolean(c.apiKey)}`,
      "Never put API keys in prompts. Use env RPCEDGE_KEY or client config only.",
    ].join("\n");
    return text(body);
  },
);

server.registerTool(
  "yellowstone_sample",
  {
    title: "Yellowstone gRPC sample",
    description:
      "Time-boxed Yellowstone slot subscription (default ~3s). Reports message count and time-to-first-message from THIS host. Not a live long-lived stream - for production use a Yellowstone client with narrow filters. Requires RPCEDGE_KEY for rpc edge gRPC.",
    inputSchema: {
      durationMs: z.number().int().min(500).max(15000).default(3000),
      maxMessages: z.number().int().min(1).max(50).default(8),
    },
  },
  async ({ durationMs, maxMessages }) => {
    try {
      return text((await yellowstoneSample(await resolveConfig(), { durationMs, maxMessages })).summary);
    } catch (e) {
      return fail(e);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

const c = await resolveConfig();
// stderr only - stdout is the MCP stream
console.error(
  `rpcedge-mcp ${VERSION} ready (default endpoint: ${hostOf(c.rpcUrl)}, keySource: ${c.keySource})`,
);
