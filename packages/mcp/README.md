# rpcedge-mcp

MCP server for [rpc edge](https://rpcedge.com) - Solana trading infrastructure tools for Claude, Cursor, Codex, and other MCP hosts.

## Install

```bash
# Claude Code
claude mcp add rpcedge -- npx rpcedge-mcp@latest

# or any host config
{
  "mcpServers": {
    "rpcedge": {
      "command": "npx",
      "args": ["rpcedge-mcp@latest"],
      "env": { "RPCEDGE_KEY": "your-uuid-key" }
    }
  }
}
```

```bash
export RPCEDGE_KEY=your-uuid-from-https://app.rpcedge.com
```

## Tools

| Tool | Purpose |
|---|---|
| `rpc_health` | Slot, version, getSlot RTT |
| `priority_fee_estimate` | p50/p75/p90/max micro-lamports/CU |
| `epoch_info` | Epoch progress |
| `next_leaders` | Next N slot leaders |
| `latency_compare` | getSlot p50 vs baseline (not landing) |
| `submit_transaction` | Signed base64 tx via relay (or rpc) + confirm |
| `doctor` | Key + health checklist |
| `endpoint_map` | Canonical endpoints + auth (no secrets) |

Keys are never written to tool output (hosts only).

## Provider-agnostic alternative

For a neutral Solana infra MCP that works with any RPC URL, see [solana-infra-mcp](https://github.com/rpc-edge/solana-infra-mcp). This package defaults to rpc edge and adds `doctor`, `endpoint_map`, and relay submit.

## License

MIT
