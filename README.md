# rpcedge-toolkit

**Open-source developer toolkit for [rpc edge](https://rpcedge.com)** - TypeScript SDK, CLI, and MCP server for Solana trading infrastructure (RPC, Yellowstone gRPC helpers, priority fees, transaction sender).

[![CI](https://github.com/rpc-edge/rpcedge-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/rpc-edge/rpcedge-toolkit/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> lowercase **rpc edge**. Physics over promises. No invented latency numbers - probes measure from *your* host; use [solbench](https://github.com/rpc-edge/solbench) co-located for infra-reflecting metrics.

## Packages

| Package | npm | Role |
|---|---|---|
| [`rpcedge-core`](./packages/core) | `rpcedge-core` | Shared endpoints, config, JSON-RPC, ops |
| [`rpcedge-sdk`](./packages/sdk) | `rpcedge-sdk` | TypeScript SDK (`RpcEdge`) |
| [`rpcedge`](./packages/cli) | `rpcedge` | CLI (`npx rpcedge doctor`) |
| [`rpcedge-mcp`](./packages/mcp) | `rpcedge-mcp` | MCP server for agents |

## 60-second start

```bash
# 1. Key from https://app.rpcedge.com/signup
export RPCEDGE_KEY=your-uuid-key

# 2. Doctor
npx rpcedge@latest doctor

# 3. Or SDK
pnpm add rpcedge-sdk
```

```ts
import { RpcEdge } from "rpcedge-sdk";

const edge = await RpcEdge.fromEnv();
console.log(await edge.getSlot());
console.log((await edge.health()).summary);
```

```bash
# 4. Agent / Claude Code
claude mcp add rpcedge -- npx rpcedge-mcp@latest
# ensure RPCEDGE_KEY is in the environment
```

## CLI

```bash
rpcedge doctor
rpcedge health --json
rpcedge slot
rpcedge fee
rpcedge leaders --count 8
rpcedge latency
rpcedge call getEpochInfo '[]'
rpcedge config set-key <uuid>
rpcedge whoami
rpcedge send --raw <base64-signed-tx>   # via relay by default
rpcedge open signup
```

## MCP tools

`rpc_health` · `priority_fee_estimate` · `epoch_info` · `next_leaders` · `latency_compare` · `submit_transaction` · `doctor` · `endpoint_map`

**Signing is always upstream.** Submit tools accept only fully signed base64 transactions. Keys never appear in tool text output.

## Config resolution (highest wins)

1. `--key` / `--url` (CLI) or constructor options (SDK)
2. `SOLANA_RPC_URL` / `SOLANA_WS_URL`
3. `RPCEDGE_KEY` (+ default `https://rpc.rpcedge.com`)
4. `~/.config/rpcedge/config.json`
5. Public mainnet-beta (demo only - not production)

## Related rpc-edge OSS

| Repo | Purpose |
|---|---|
| [solana-infra-mcp](https://github.com/rpc-edge/solana-infra-mcp) | Provider-agnostic Solana infra MCP |
| [solbench](https://github.com/rpc-edge/solbench) | Honest RPC/gRPC latency harness |
| [rpcedge-relay-client](https://github.com/rpc-edge/rpcedge-relay-client) | Rust transaction relay client |

## Develop

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test

# run CLI from workspace
pnpm --filter rpcedge exec node dist/index.js doctor
```

Node ≥ 20. pnpm 11.

## Security

- Never commit API keys or put them in model prompts
- Config file is written mode `0600`
- Logs and MCP output redact `?key=` and mask key material
- Report security issues privately to the maintainers

## License

MIT © 0xNyk · product by [Polaris Labs](https://polarislab.xyz) / [rpc edge](https://rpcedge.com)
