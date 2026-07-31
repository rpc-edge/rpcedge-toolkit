# rpcedge-mcp

**MCP server for [rpc edge](https://rpcedge.com)** - give Claude, Cursor, Codex, and other agents live Solana infra tools (health, fees, leaders, relay submit).

```bash
export RPCEDGE_KEY=your-uuid-key   # https://app.rpcedge.com/signup
claude mcp add rpcedge -- npx rpcedge-mcp@latest
```

Then ask: *"Check my RPC health and estimate priority fees."*

[![npm](https://img.shields.io/npm/v/rpcedge-mcp.svg)](https://www.npmjs.com/package/rpcedge-mcp)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![Glama](https://glama.ai/mcp/servers/rpc-edge/rpcedge-toolkit/badges/score.svg)](https://glama.ai/mcp/servers/rpc-edge/rpcedge-toolkit)

## Install (any MCP host)

**Claude Code**

```bash
claude mcp add rpcedge -- npx rpcedge-mcp@latest
```

**Claude Desktop / Cursor / VS Code** - add to MCP config:

```json
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

**Codex**

```bash
codex mcp add rpcedge -- npx rpcedge-mcp@latest
```

## Tools

| Tool | Purpose |
|---|---|
| `doctor` | Key + health checklist |
| `rpc_health` | Slot, version, getSlot RTT |
| `priority_fee_estimate` | p50/p75/p90/max micro-lamports/CU |
| `epoch_info` | Epoch progress |
| `next_leaders` | Next N slot leaders |
| `latency_compare` | getSlot p50 vs baseline (not landing) |
| `submit_transaction` | Signed base64 tx via relay + confirm |
| `endpoint_map` | Canonical endpoints + auth (no secrets) |
| `yellowstone_sample` | Time-boxed gRPC slot sample (needs key) |

**Signing is always upstream.** Submit tools never hold private keys. API keys are never echoed in tool text.

## Claude Code plugin

From a clone of [rpcedge-toolkit](https://github.com/rpc-edge/rpcedge-toolkit):

```bash
# Claude Code: add local plugin marketplace or install the plugin dir
/plugin marketplace add rpc-edge/rpcedge-toolkit
# or point Claude at this repo's .claude-plugin + skills/rpcedge
export RPCEDGE_KEY=your-uuid-key
```

Skill `skills/rpcedge/SKILL.md` teaches tool routing. MCP defaults to `npx -y rpcedge-mcp@latest`.

## Env

| Variable | Purpose |
|---|---|
| `RPCEDGE_KEY` | Preferred - points tools at rpc edge |
| `SOLANA_RPC_URL` | Full URL (any Solana RPC) |

## Docker (Glama / directory checks)

Repo-root Dockerfile installs published `rpcedge-mcp` and speaks stdio MCP (tools/list works without a key):

```bash
# from monorepo root
docker build -t rpcedge-mcp .
docker run -i --rm -e RPCEDGE_KEY rpcedge-mcp
```

Glama listing: https://glama.ai/mcp/servers/rpc-edge/rpcedge-toolkit

## Provider-agnostic alternative

For a neutral Solana infra MCP (any RPC URL, no brand defaults), see [solana-infra-mcp](https://github.com/rpc-edge/solana-infra-mcp).

## Related

- CLI: [`rpcedge`](https://www.npmjs.com/package/rpcedge)
- SDK: [`rpcedge-sdk`](https://www.npmjs.com/package/rpcedge-sdk)
- Agent guide: [rpcedge.com/skills.md](https://rpcedge.com/skills.md)
- Signup: [app.rpcedge.com/signup](https://app.rpcedge.com/signup)

## License

MIT · [rpc edge](https://rpcedge.com)
