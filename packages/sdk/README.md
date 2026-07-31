# rpcedge-sdk

**TypeScript SDK for [rpc edge](https://rpcedge.com)** - typed RPC helpers, health/fee probes, and transaction sender without raw URL glue.

```bash
pnpm add rpcedge-sdk
export RPCEDGE_KEY=your-uuid-key   # https://app.rpcedge.com/signup
```

```ts
import { RpcEdge } from "rpcedge-sdk";

const edge = await RpcEdge.fromEnv();
console.log(await edge.getSlot());
console.log((await edge.health()).summary);
console.log((await edge.priorityFees()).summary);

// optional peer
const conn = await edge.connection(); // @solana/web3.js
// edge.grpcHost + edge.grpcMetadata for Yellowstone clients
```

[![npm](https://img.shields.io/npm/v/rpcedge-sdk.svg)](https://www.npmjs.com/package/rpcedge-sdk)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

## Install

```bash
pnpm add rpcedge-sdk
# optional
pnpm add @solana/web3.js
```

## API (essentials)

| Method | Purpose |
|---|---|
| `RpcEdge.fromEnv()` | Resolve key + endpoints from env / config |
| `RpcEdge.withKey(key)` | Explicit key → rpc edge defaults |
| `getSlot()` / `call(method, params)` | JSON-RPC |
| `health()` / `priorityFees()` / `epochInfo()` / `nextLeaders()` | Trading probes |
| `doctor()` | Checklist for setup issues |
| `connection()` | `@solana/web3.js` Connection (optional peer) |
| `sendSignedTransaction(b64, { via })` | Relay (default) or RPC submit - **signed only** |
| `grpcHost` / `grpcMetadata` | Wire any Yellowstone client |

## Env

| Variable | Purpose |
|---|---|
| `RPCEDGE_KEY` | UUID from [app.rpcedge.com](https://app.rpcedge.com/signup) |
| `SOLANA_RPC_URL` | Full URL override (any provider) |
| `SOLANA_WS_URL` | WebSocket override |
| `RPCEDGE_RELAY_URL` | Relay base (default `https://relay.rpcedge.com`) |
| `YELLOWSTONE_GRPC_URL` | gRPC host:port |

Never put keys in prompts or commits.

## Related

- CLI: `npx rpcedge@latest doctor`
- MCP: `claude mcp add rpcedge -- npx rpcedge-mcp@latest`
- Source: [rpc-edge/rpcedge-toolkit](https://github.com/rpc-edge/rpcedge-toolkit)

## License

MIT · [rpc edge](https://rpcedge.com)
