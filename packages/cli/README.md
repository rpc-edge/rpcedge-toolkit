# rpcedge

CLI for [rpc edge](https://rpcedge.com) Solana infrastructure.

```bash
# one-shot (no global install)
npx rpcedge@latest doctor

# or install
pnpm add -g rpcedge
export RPCEDGE_KEY=your-uuid-from-app.rpcedge.com
rpcedge doctor
rpcedge health --json
rpcedge slot
rpcedge fee
rpcedge call getEpochInfo '[]'
```

## Commands

| Command | Purpose |
|---|---|
| `doctor` | Key + health checks with fix hints |
| `health` | Slot, version, getSlot RTT |
| `slot` / `fee` / `epoch` / `leaders` | Common trading probes |
| `latency [urls...]` | getSlot p50 compare (not a landing metric) |
| `call <method> [paramsJson]` | Raw JSON-RPC |
| `send --raw <b64>` | Submit signed tx via relay (or `--via rpc`) |
| `config set-key <key>` | Save key to `~/.config/rpcedge/config.json` |
| `whoami` | Masked key + endpoints |
| `mcp` | Launch `rpcedge-mcp` on stdio |
| `open signup` | Print signup URL |

Global: `--json`, `--key`, `--url`.

## Part of

[rpcedge-toolkit](https://github.com/rpc-edge/rpcedge-toolkit) - also ships `rpcedge-sdk` and `rpcedge-mcp`.

## License

MIT
