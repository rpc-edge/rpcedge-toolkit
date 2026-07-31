# rpcedge-sdk

TypeScript SDK for [rpc edge](https://rpcedge.com) - Solana RPC, health/fee probes, and the transaction sender.

Part of [rpcedge-toolkit](https://github.com/rpc-edge/rpcedge-toolkit).

## Install

```bash
pnpm add rpcedge-sdk
# optional, for Connection helper
pnpm add @solana/web3.js
```

## Quickstart

```ts
import { RpcEdge } from "rpcedge-sdk";

// Reads RPCEDGE_KEY (or SOLANA_RPC_URL / ~/.config/rpcedge/config.json)
const edge = await RpcEdge.fromEnv();

console.log(await edge.getSlot());           // processed by default
console.log((await edge.health()).summary);
console.log((await edge.priorityFees()).summary);

// @solana/web3.js when installed
const conn = await edge.connection();
console.log(await conn.getSlot("processed"));

// Yellowstone helpers (wire your geyser client)
// edge.grpcHost  -> grpc.rpcedge.com:443
// edge.grpcMetadata -> { "x-api-key", authorization }
```

With an explicit key:

```ts
const edge = RpcEdge.withKey(process.env.RPCEDGE_KEY!);
```

## Env

| Variable | Purpose |
|---|---|
| `RPCEDGE_KEY` | UUID API key from https://app.rpcedge.com |
| `SOLANA_RPC_URL` | Full RPC URL override (any provider) |
| `SOLANA_WS_URL` | WebSocket override |
| `RPCEDGE_RELAY_URL` | Relay base (default `https://relay.rpcedge.com`) |
| `YELLOWSTONE_GRPC_URL` | gRPC host:port |

Never put keys in prompts or commit them. Use env or `rpcedge config set-key`.

## Related

- CLI: [`rpcedge`](../cli) - `npx rpcedge doctor`
- MCP: [`rpcedge-mcp`](../mcp) - agent tools
- Provider-agnostic MCP: [solana-infra-mcp](https://github.com/rpc-edge/solana-infra-mcp)
- Relay (Rust): [rpcedge-relay-client](https://github.com/rpc-edge/rpcedge-relay-client)

## License

MIT
