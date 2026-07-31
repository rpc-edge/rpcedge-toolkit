#!/usr/bin/env node
/**
 * rpcedge CLI - human + agent surface for rpc edge infrastructure.
 *
 * Usage:
 *   rpcedge doctor
 *   rpcedge health [--json]
 *   rpcedge slot
 *   rpcedge fee
 *   rpcedge epoch
 *   rpcedge leaders [--count 8]
 *   rpcedge call <method> [paramsJson]
 *   rpcedge send --raw <base64> [--via relay|rpc]
 *   rpcedge config set-key <key>
 *   rpcedge config path
 *   rpcedge whoami
 *   rpcedge mcp          # spawn stdio MCP (requires rpcedge-mcp installed)
 *   rpcedge open signup
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  DEFAULTS,
  resolveConfig,
  writeConfigFile,
  defaultConfigPath,
  maskKey,
  redactUrl,
  rpcCall,
  health,
  priorityFees,
  epochInfo,
  nextLeaders,
  doctor,
  submitViaRelay,
  submitViaRpc,
  latencyCompare,
  RpcEdgeError,
  type ResolvedConfig,
} from "rpcedge-core";

const VERSION = "0.1.1";

interface GlobalFlags {
  json: boolean;
  key?: string;
  url?: string;
  help: boolean;
}

function parseGlobals(argv: string[]): { flags: GlobalFlags; rest: string[] } {
  const flags: GlobalFlags = { json: false, help: false };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json" || a === "-j") flags.json = true;
    else if (a === "--help" || a === "-h") flags.help = true;
    else if (a === "--key" || a === "-k") flags.key = argv[++i];
    else if (a === "--url") flags.url = argv[++i];
    else if (a === "--version" || a === "-V") {
      console.log(VERSION);
      process.exit(0);
    } else rest.push(a);
  }
  return { flags, rest };
}

function printHelp(): void {
  console.log(`rpcedge ${VERSION} - cli for rpc edge Solana infrastructure

Usage:
  rpcedge <command> [options]

Commands:
  doctor              Check key, endpoint health, and print a fix-oriented summary
  health              Version, slot, getSlot latency
  slot                Current slot (processed)
  fee                 Priority-fee percentiles (micro-lamports/CU)
  epoch               Epoch progress
  leaders [--count N] Next N slot leaders (default 8)
  latency [url...]    Compare getSlot p50 (default: configured + public mainnet)
  call <method> [jsonParams]
                      Raw JSON-RPC method
  send --raw <b64> [--via relay|rpc] [--wait-ms N]
                      Submit a CALLER-SIGNED base64 transaction
  config set-key <key>
                      Save API key to ~/.config/rpcedge/config.json (mode 600)
  config path         Print config file path
  whoami              Masked key + endpoint labels
  mcp                 Run the branded MCP server (rpcedge-mcp) on stdio
  open signup         Print / open signup URL

Global options:
  --json, -j          Machine-readable JSON on stdout
  --key, -k <key>     API key override
  --url <rpcUrl>      Full RPC URL override
  --help, -h          Help
  --version, -V       Version

Env:
  RPCEDGE_KEY         Preferred API key
  SOLANA_RPC_URL      Full RPC URL (any provider)
  RPCEDGE_RELAY_URL   Relay base (default ${DEFAULTS.relayBase})

Docs: ${DEFAULTS.docs}  ·  skills: ${DEFAULTS.skills}  ·  signup: ${DEFAULTS.signup}
`);
}

function out(flags: GlobalFlags, human: string, data: unknown): void {
  if (flags.json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(human);
  }
}

function fail(err: unknown, json: boolean): never {
  if (json) {
    if (err instanceof RpcEdgeError) {
      console.log(JSON.stringify({ error: err.toJSON() }));
    } else {
      console.log(JSON.stringify({ error: { message: err instanceof Error ? err.message : String(err) } }));
    }
  } else if (err instanceof RpcEdgeError) {
    console.error(`error [${err.code}]: ${err.message}`);
    if (err.nextAction) console.error(`  → ${err.nextAction}`);
  } else {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  }
  process.exit(1);
}

async function cfgFrom(flags: GlobalFlags): Promise<ResolvedConfig> {
  return resolveConfig({ apiKey: flags.key, rpcUrl: flags.url });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printHelp();
    process.exit(0);
  }

  const { flags, rest } = parseGlobals(argv);
  const cmd = rest[0];

  if (flags.help || cmd === "help") {
    printHelp();
    return;
  }

  try {
    switch (cmd) {
      case "doctor": {
        const cfg = await cfgFrom(flags);
        const report = await doctor(cfg);
        out(flags, report.summary, report);
        process.exit(report.ok ? 0 : 2);
        break;
      }
      case "health": {
        const cfg = await cfgFrom(flags);
        const report = await health(cfg);
        out(flags, report.summary, report);
        break;
      }
      case "slot": {
        const cfg = await cfgFrom(flags);
        const r = await rpcCall<number>({
          url: cfg.rpcUrl,
          method: "getSlot",
          params: [{ commitment: "processed" }],
          apiKey: cfg.apiKey,
        });
        out(flags, String(r.result), { slot: r.result, latencyMs: r.latencyMs, host: r.host });
        break;
      }
      case "fee":
      case "fees": {
        const cfg = await cfgFrom(flags);
        const report = await priorityFees(cfg);
        out(flags, report.summary, report);
        break;
      }
      case "epoch": {
        const cfg = await cfgFrom(flags);
        const report = await epochInfo(cfg);
        out(flags, report.summary, report);
        break;
      }
      case "leaders": {
        let count = 8;
        for (let i = 1; i < rest.length; i++) {
          if (rest[i] === "--count" || rest[i] === "-n") count = Number(rest[++i]);
        }
        const cfg = await cfgFrom(flags);
        const report = await nextLeaders(cfg, count);
        out(flags, report.summary, report);
        break;
      }
      case "latency": {
        const cfg = await cfgFrom(flags);
        const extra = rest.slice(1).filter((a) => !a.startsWith("-"));
        const urls = extra.length > 0 ? extra : [cfg.rpcUrl, DEFAULTS.publicMainnet];
        const report = await latencyCompare(urls, 8, cfg.apiKey);
        out(flags, report.summary, report);
        break;
      }
      case "call": {
        const method = rest[1];
        if (!method) throw new RpcEdgeError("invalid_argument", "usage: rpcedge call <method> [paramsJson]");
        let params: unknown[] = [];
        if (rest[2]) {
          try {
            params = JSON.parse(rest[2]) as unknown[];
            if (!Array.isArray(params)) throw new Error("params must be a JSON array");
          } catch (e) {
            throw new RpcEdgeError("invalid_argument", `invalid params JSON: ${e instanceof Error ? e.message : e}`);
          }
        }
        const cfg = await cfgFrom(flags);
        const r = await rpcCall<unknown>({
          url: cfg.rpcUrl,
          method,
          params,
          apiKey: cfg.apiKey,
        });
        out(flags, JSON.stringify(r.result, null, 2), { result: r.result, latencyMs: r.latencyMs, host: r.host });
        break;
      }
      case "send": {
        let raw: string | undefined;
        let via: "relay" | "rpc" = "relay";
        let waitMs = 30_000;
        for (let i = 1; i < rest.length; i++) {
          const a = rest[i]!;
          if (a === "--raw") raw = rest[++i];
          else if (a === "--via") via = rest[++i] as "relay" | "rpc";
          else if (a === "--wait-ms") waitMs = Number(rest[++i]);
        }
        if (!raw) throw new RpcEdgeError("invalid_argument", "usage: rpcedge send --raw <base64> [--via relay|rpc]");
        const cfg = await cfgFrom(flags);
        const report =
          via === "rpc"
            ? await submitViaRpc(cfg, raw, waitMs)
            : await submitViaRelay(cfg, raw, waitMs);
        out(flags, report.summary, report);
        process.exit(report.landed ? 0 : 3);
        break;
      }
      case "config": {
        const sub = rest[1];
        if (sub === "path") {
          out(flags, defaultConfigPath(), { path: defaultConfigPath() });
          break;
        }
        if (sub === "set-key") {
          const key = rest[2];
          if (!key) throw new RpcEdgeError("invalid_argument", "usage: rpcedge config set-key <key>");
          await writeConfigFile({ apiKey: key.trim() });
          const path = defaultConfigPath();
          out(
            flags,
            `saved key ${maskKey(key)} to ${path} (mode 600)`,
            { path, key: maskKey(key) },
          );
          break;
        }
        throw new RpcEdgeError("invalid_argument", "usage: rpcedge config set-key <key> | path");
      }
      case "whoami": {
        const cfg = await cfgFrom(flags);
        const data = {
          host: cfg.label,
          keySource: cfg.keySource,
          hasKey: Boolean(cfg.apiKey),
          key: cfg.apiKey ? maskKey(cfg.apiKey) : null,
          rpcUrl: redactUrl(cfg.rpcUrl),
          wsUrl: redactUrl(cfg.wsUrl),
          grpcHost: cfg.grpcHost,
          relayBase: cfg.relayBase,
          configPath: cfg.configPath,
        };
        const human = [
          `host        ${data.host}`,
          `key         ${data.key ?? "(none)"}  source=${data.keySource}`,
          `rpc         ${data.rpcUrl}`,
          `ws          ${data.wsUrl}`,
          `grpc        ${data.grpcHost}`,
          `relay       ${data.relayBase}`,
          `config      ${data.configPath}`,
        ].join("\n");
        out(flags, human, data);
        break;
      }
      case "mcp": {
        await runMcp();
        break;
      }
      case "open": {
        const what = rest[1] ?? "signup";
        const url = what === "signup" ? DEFAULTS.signup : what === "docs" ? DEFAULTS.docs : DEFAULTS.site;
        out(flags, url, { url });
        break;
      }
      default:
        throw new RpcEdgeError("invalid_argument", `unknown command: ${cmd}`, {
          nextAction: "Run `rpcedge --help` for the command list.",
        });
    }
  } catch (e) {
    fail(e, flags.json);
  }
}

async function runMcp(): Promise<void> {
  // Prefer sibling workspace package, then installed rpcedge-mcp.
  const require = createRequire(import.meta.url);
  let entry: string | undefined;
  try {
    entry = require.resolve("rpcedge-mcp/package.json");
    // package.json path -> dist/index.js
    entry = entry.replace(/package\.json$/, "dist/index.js");
  } catch {
    try {
      // monorepo sibling
      const sibling = new URL("../mcp/dist/index.js", import.meta.url);
      entry = sibling.pathname;
    } catch {
      /* fall through */
    }
  }
  if (!entry) {
    throw new RpcEdgeError("config", "rpcedge-mcp is not installed", {
      nextAction: "pnpm add -g rpcedge-mcp   or   npx rpcedge-mcp",
    });
  }
  const child = spawn(process.execPath, [entry], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => process.exit(code ?? 1));
  // keep process alive for stdio MCP
  await new Promise(() => {});
}

// Avoid unused import lint if tree-shaken oddly
void pathToFileURL;

main();
