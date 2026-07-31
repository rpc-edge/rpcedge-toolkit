# Distribution pack - rpcedge toolkit

Track listings and outreach that put `rpcedge` / `rpcedge-mcp` / `rpcedge-sdk` in front of
developers and agents. Product source of truth:
https://github.com/rpc-edge/rpcedge-toolkit

## Install one-liners (copy into listings)

**CLI**

```bash
export RPCEDGE_KEY=your-uuid-key   # https://app.rpcedge.com/signup
npx rpcedge@latest doctor
```

**MCP (Claude Code)**

```bash
export RPCEDGE_KEY=your-uuid-key
claude mcp add rpcedge -- npx rpcedge-mcp@latest
```

**MCP (generic host config)**

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

**SDK**

```bash
pnpm add rpcedge-sdk
```

## Package facts

| Field | Value |
|---|---|
| npm CLI | https://www.npmjs.com/package/rpcedge |
| npm SDK | https://www.npmjs.com/package/rpcedge-sdk |
| npm MCP | https://www.npmjs.com/package/rpcedge-mcp |
| GitHub | https://github.com/rpc-edge/rpcedge-toolkit |
| License | MIT |
| Node | ≥ 20 |
| Product | https://rpcedge.com |
| Signup | https://app.rpcedge.com/signup |
| Skills | https://rpcedge.com/skills.md |
| Agents | https://rpcedge.com/agents |
| Docs quickstart | https://docs.rpcedge.com/getting-started/quickstart |

**Short description (≤160 chars)**

> Open-source SDK, CLI, and MCP for rpc edge Solana infra: doctor, health, fees, leaders, relay submit. `npx rpcedge doctor`.

**Long description**

rpc edge toolkit is the open developer surface for rpc edge Solana trading infrastructure.
Use the CLI to prove a key (`npx rpcedge doctor`), the TypeScript SDK for bots
(`RpcEdge.fromEnv()`), or the MCP server so Claude/Cursor/Codex can call health, priority
fees, leaders, and signed-tx submit as tools. Keys stay in env - never in prompts. Physics
over promises: probes measure from your host; use solbench co-located for infra metrics.

**Keywords / topics**

`solana` `rpc` `mcp` `cli` `sdk` `trading` `hft` `yellowstone` `grpc` `agents` `claude`

**MCP tools (for registry forms)**

`doctor`, `rpc_health`, `priority_fee_estimate`, `epoch_info`, `next_leaders`,
`latency_compare`, `yellowstone_sample`, `submit_transaction`, `endpoint_map`

**Ready-to-paste pack (monorepo):**  
`marketing/toolkit-directory-submissions-2026-07-31.md` in https://github.com/rpc-edge/rpcedge  
(short/medium/long blurbs + per-directory field tables).

## Registry checklist

Mark when submitted. Prefer official forms; do not automate logins.

| Target | URL | Status | Notes |
|---|---|---|---|
| npm (packages) | registry.npmjs.org | ✅ 0.1.2 | Published via GitHub Release |
| GitHub topics | repo settings | ✅ 2026-07-31 | solana, rpc, mcp, cli, sdk, trading, … |
| mcp.so | https://mcp.so | ☐ | Free path needs account + form; pack in monorepo marketing/ |
| Glama MCP | https://glama.ai/mcp/servers/rpc-edge/rpcedge-toolkit | ✅ claimed | Dockerfile + glama.json (`0xNyk`) on main |
| Smithery | https://smithery.ai | ☐ | If they accept stdio/npx servers |
| PulseMCP | https://www.pulsemcp.com | ☐ | Agent/MCP discovery |
| Official MCP Registry | registry.modelcontextprotocol.io | ☐ | Branded + solana-infra-mcp twin |
| awesome-mcp-servers | [PR #11254](https://github.com/punkpeye/awesome-mcp-servers/pull/11254) | ✅ checks green · waiting merge | has-glama · check-submission pass |
| awesome-solana-ai | [PR #193](https://github.com/solana-foundation/awesome-solana-ai/pull/193) | ⏳ open · infra-mcp + toolkit lines | Rebased 2026-07-31 |
| SendAI Solana Skills | solanaskills.com | ☐ | Doctor + MCP install |
| Claude plugin marketplace | `.claude-plugin/` + `skills/rpcedge` in this repo | ✅ in-repo | `/plugin marketplace add` or local install |

Provider-agnostic twin: [solana-infra-mcp](https://github.com/rpc-edge/solana-infra-mcp) -
list as the neutral option; this package is the branded rpc edge path.

## Outreach draft (X / Discord / Telegram)

Keep voice: lowercase rpc edge, hyphen, no invented latency.

```text
shipped open DX for rpc edge:

npx rpcedge@latest doctor
claude mcp add rpcedge -- npx rpcedge-mcp@latest
pnpm add rpcedge-sdk

prove the key, wire the bot, or hand tools to your agent.
mit · github.com/rpc-edge/rpcedge-toolkit
signup → app.rpcedge.com/signup
```

## Funnel UTM (optional)

When linking from GitHub README social / listings:

```text
https://app.rpcedge.com/signup?utm_source=github&utm_medium=oss&utm_campaign=rpcedge-toolkit
https://rpcedge.com/agents?utm_source=mcp-directory&utm_medium=listing&utm_campaign=rpcedge-mcp
```

## After listing

1. Wait for production deploy of marketing/docs if URLs changed.
2. IndexNow the agent surfaces (see monorepo `docs/INDEXNOW.md`).
3. Do not bulk-submit the full sitemap - only changed URLs.
