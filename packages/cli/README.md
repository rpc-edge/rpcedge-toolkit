# rpcedge

**CLI for [rpc edge](https://rpcedge.com)** - prove your Solana RPC key works, probe fees/leaders, submit signed txs via the relay.

```bash
export RPCEDGE_KEY=your-uuid-key   # https://app.rpcedge.com/signup
npx rpcedge@latest doctor
```

[![npm](https://img.shields.io/npm/v/rpcedge.svg)](https://www.npmjs.com/package/rpcedge)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

## Install

```bash
# one-shot
npx rpcedge@latest doctor

# or global
pnpm add -g rpcedge
rpcedge doctor
```

## Commands

| Command | Purpose |
|---|---|
| `doctor` | Key + health with fix-oriented next steps |
| `health` | Slot, version, getSlot RTT (this host) |
| `slot` / `fee` / `epoch` / `leaders` | Trading probes |
| `latency [urls...]` | getSlot p50 compare - **not** a landing metric |
| `call <method> [paramsJson]` | Raw JSON-RPC |
| `send --raw <b64>` | Submit signed tx via relay (`--via rpc` for standard) |
| `config set-key <key>` | Save to `~/.config/rpcedge/config.json` (mode 600) |
| `whoami` | Masked key + endpoints |
| `mcp` | Spawn `rpcedge-mcp` on stdio |
| `open signup` | Print dashboard signup URL |

Global: `--json` · `--key` · `--url`

## Example

```bash
npx rpcedge@latest health --json
npx rpcedge@latest fee
npx rpcedge@latest call getEpochInfo '[]'
npx rpcedge@latest send --raw "$SIGNED_TX_B64"
```

## Config

`RPCEDGE_KEY` → `https://rpc.rpcedge.com` by default. Also: `SOLANA_RPC_URL`, config file, CLI flags. See the [monorepo README](https://github.com/rpc-edge/rpcedge-toolkit#config-highest-wins).

## Related

- SDK: [`rpcedge-sdk`](https://www.npmjs.com/package/rpcedge-sdk)
- MCP: [`rpcedge-mcp`](https://www.npmjs.com/package/rpcedge-mcp)
- Signup: [app.rpcedge.com/signup](https://app.rpcedge.com/signup)

## License

MIT · [rpc edge](https://rpcedge.com)
