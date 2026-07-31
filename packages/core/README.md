# rpcedge-core

Shared client core for the [rpc edge](https://rpcedge.com) toolkit: endpoint defaults, config resolution, JSON-RPC, health/fee probes, and transaction relay helpers.

You usually **do not install this directly** - it is a dependency of:

- [`rpcedge-sdk`](https://www.npmjs.com/package/rpcedge-sdk) - TypeScript bots
- [`rpcedge`](https://www.npmjs.com/package/rpcedge) - CLI (`npx rpcedge doctor`)
- [`rpcedge-mcp`](https://www.npmjs.com/package/rpcedge-mcp) - agent tools

```bash
# start here instead
npx rpcedge@latest doctor
pnpm add rpcedge-sdk
```

[![npm](https://img.shields.io/npm/v/rpcedge-core.svg)](https://www.npmjs.com/package/rpcedge-core)

Source monorepo: [rpc-edge/rpcedge-toolkit](https://github.com/rpc-edge/rpcedge-toolkit)

## License

MIT · [rpc edge](https://rpcedge.com)
