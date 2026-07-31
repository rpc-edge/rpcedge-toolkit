# rpcedge-toolkit

**Ship Solana trading bots and agents without wiring endpoints by hand.**

Open-source **SDK · CLI · MCP** for [rpc edge](https://rpcedge.com) - JSON-RPC, priority fees, leader schedule, health probes, and the transaction sender. One env var. Keys never in prompts.

[![CI](https://github.com/rpc-edge/rpcedge-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/rpc-edge/rpcedge-toolkit/actions/workflows/ci.yml)
[![npm rpcedge](https://img.shields.io/npm/v/rpcedge.svg?label=rpcedge)](https://www.npmjs.com/package/rpcedge)
[![npm rpcedge-sdk](https://img.shields.io/npm/v/rpcedge-sdk.svg?label=rpcedge-sdk)](https://www.npmjs.com/package/rpcedge-sdk)
[![npm rpcedge-mcp](https://img.shields.io/npm/v/rpcedge-mcp.svg?label=rpcedge-mcp)](https://www.npmjs.com/package/rpcedge-mcp)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

```bash
export RPCEDGE_KEY=your-uuid-from-app   # https://app.rpcedge.com/signup
npx rpcedge@latest doctor              # green in under a minute
```

---

## Why this exists

Most Solana bots start the same way: paste a URL, forget the WebSocket, mis-auth gRPC, send txs to the public RPC, then debug auth at 2am.

This toolkit collapses that path:

| Job | Without toolkit | With toolkit |
|---|---|---|
| Prove the key works | hand-written curl | `npx rpcedge doctor` |
| Wire TypeScript | raw URL strings | `RpcEdge.fromEnv()` |
| Agent / Claude / Cursor | docs copy-paste | `npx rpcedge-mcp` tools |
| Land a signed tx | guess the right path | `rpcedge send --raw` → relay |

**rpc edge** is co-located Solana infra (RPC, Yellowstone gRPC, sender) for trading bots - self-serve from **$249/mo USDC**, Frankfurt / FR13. This repo is the open DX layer on top. Measure claims yourself with [solbench](https://github.com/rpc-edge/solbench) - we do not invent latency heroes here.

---

## Pick your path

### 1. Human - prove the endpoint (60s)

```bash
# Get a key: https://app.rpcedge.com/signup
export RPCEDGE_KEY=your-uuid-key

npx rpcedge@latest doctor
npx rpcedge@latest health --json
npx rpcedge@latest fee          # p50/p75/p90 micro-lamports/CU
```

Save the key for later sessions:

```bash
npx rpcedge@latest config set-key "$RPCEDGE_KEY"
npx rpcedge@latest whoami
```

**CTA:** no account yet? → [Sign up · rpc edge dashboard](https://app.rpcedge.com/signup)

### 2. TypeScript bot - first `getSlot`

```bash
pnpm add rpcedge-sdk
# optional: pnpm add @solana/web3.js
```

```ts
import { RpcEdge } from "rpcedge-sdk";

const edge = await RpcEdge.fromEnv(); // RPCEDGE_KEY or config file
console.log(await edge.getSlot());    // commitment: processed by default
console.log((await edge.health()).summary);
console.log((await edge.priorityFees()).summary);

// Ecosystem Connection when you need it
const conn = await edge.connection();
// Yellowstone: edge.grpcHost + edge.grpcMetadata (x-api-key / Bearer)
```

### 3. Coding agent - MCP in one line

```bash
export RPCEDGE_KEY=your-uuid-key
claude mcp add rpcedge -- npx rpcedge-mcp@latest
# also works with Cursor / Codex / any stdio MCP host
```

Ask: *"Check my RPC health and estimate priority fees."*

| Tool | What the agent can do |
|---|---|
| `doctor` | Key + health checklist with next actions |
| `rpc_health` | Slot, solana-core, getSlot RTT from this host |
| `priority_fee_estimate` | p50/p75/p90/max micro-lamports per CU |
| `epoch_info` / `next_leaders` | Epoch progress + leader timing |
| `latency_compare` | getSlot p50 vs baseline (not a landing metric) |
| `submit_transaction` | Relay **caller-signed** base64 tx + confirm |
| `endpoint_map` | Canonical endpoints + auth (no secrets) |

**Signing is always upstream.** Submit accepts only fully signed transactions. Keys never appear in tool text.

Machine integration guide: [rpcedge.com/skills.md](https://rpcedge.com/skills.md) · [Agents](https://rpcedge.com/agents)

---

## Packages

| Package | npm | Use when |
|---|---|---|
| [`rpcedge`](./packages/cli) | [`rpcedge`](https://www.npmjs.com/package/rpcedge) | Shell, CI, doctor, ops |
| [`rpcedge-sdk`](./packages/sdk) | [`rpcedge-sdk`](https://www.npmjs.com/package/rpcedge-sdk) | TypeScript bots / services |
| [`rpcedge-mcp`](./packages/mcp) | [`rpcedge-mcp`](https://www.npmjs.com/package/rpcedge-mcp) | Claude / Cursor / agents |
| [`rpcedge-core`](./packages/core) | [`rpcedge-core`](https://www.npmjs.com/package/rpcedge-core) | Shared internals (usually transitive) |

---

## CLI reference

```bash
npx rpcedge@latest doctor
npx rpcedge@latest health --json
npx rpcedge@latest slot
npx rpcedge@latest fee
npx rpcedge@latest epoch
npx rpcedge@latest leaders --count 8
npx rpcedge@latest latency                  # this host's getSlot p50 - not landing
npx rpcedge@latest call getEpochInfo '[]'
npx rpcedge@latest send --raw <base64>      # relay by default; --via rpc
npx rpcedge@latest config set-key <uuid>
npx rpcedge@latest whoami
npx rpcedge@latest open signup
```

Global flags: `--json` · `--key <uuid>` · `--url <rpcUrl>`

---

## Config (highest wins)

1. CLI `--key` / `--url` or SDK options  
2. `SOLANA_RPC_URL` / `SOLANA_WS_URL` (any provider)  
3. `RPCEDGE_KEY` → defaults to `https://rpc.rpcedge.com`  
4. `~/.config/rpcedge/config.json` (mode `0600`)  
5. Public mainnet-beta (demo only - not production)

Optional: `RPCEDGE_RELAY_URL`, `YELLOWSTONE_GRPC_URL` / `RPCEDGE_GRPC_HOST`

---

## When to use rpc edge

**Good fit:** trading bots, copy-trading, DLMM, market-making, arb/liquidations, on-chain agents that need low-latency Solana RPC/gRPC/sender and self-serve USDC billing.

**Not a fit:** free hobby / learning only (public RPC is fine), multi-chain one-vendor needs, pure archive dumps.

Pricing: [rpcedge.com/pricing](https://rpcedge.com/pricing) · Docs: [docs.rpcedge.com](https://docs.rpcedge.com) · Benchmarks: [rpcedge.com/benchmarks](https://rpcedge.com/benchmarks)

---

## Security

- Never commit API keys or put them in model prompts  
- Config file is written mode `0600`  
- Logs and MCP output redact `?key=` and mask key material  
- Submit tools are **keyless for signing** - sign upstream only  
- Report security issues privately to the maintainers  

---

## Related OSS

| Repo | Purpose |
|---|---|
| [solana-infra-mcp](https://github.com/rpc-edge/solana-infra-mcp) | Provider-agnostic Solana infra MCP |
| [solbench](https://github.com/rpc-edge/solbench) | Honest RPC/gRPC latency harness |
| [rpcedge-relay-client](https://github.com/rpc-edge/rpcedge-relay-client) | Rust transaction relay client |

---

## Develop

```bash
pnpm install && pnpm build && pnpm test
pnpm e2e                    # CLI + SDK + MCP live + publish dry-run
RPCEDGE_KEY=… pnpm e2e      # production endpoint path
pnpm e2e:registry           # npm view + npx smoke
```

Node ≥ 20 · pnpm 11 · Publish: [docs/PUBLISH.md](./docs/PUBLISH.md)

---

## License

MIT © 0xNyk · product by [Polaris Labs](https://polarislab.xyz) / [rpc edge](https://rpcedge.com)

**Next step:** [get a key](https://app.rpcedge.com/signup) → `npx rpcedge@latest doctor`
