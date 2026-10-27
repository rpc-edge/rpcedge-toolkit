import { describe, it, expect } from "vitest";
import { buildMcpEnv } from "./mcp-env.js";

const parent: NodeJS.ProcessEnv = {
  PATH: "/usr/bin:/bin",
  HOME: "/fake-home",
  TERM: "xterm-256color",
  NO_COLOR: "1",
  XDG_CONFIG_HOME: "/fake-home/.config",
  RPCEDGE_KEY: "rpcedge-key",
  RPCEDGE_RPC_URL: "https://rpc.example",
  SOLANA_RPC_URL: "https://solana.example",
  SOLANA_WS_URL: "wss://solana.example",
  YELLOWSTONE_GRPC_URL: "https://grpc.example",
  // Must never reach the MCP child:
  SOLANA_PRIVATE_KEY: "fake-private-key",
  ANCHOR_WALLET: "/fake-home/.config/solana/id.json",
  WALLET_SEED_PHRASE: "abandon abandon abandon",
  GITHUB_TOKEN: "ghp_secret",
  NPM_TOKEN: "npm_secret",
  AWS_SECRET_ACCESS_KEY: "aws_secret",
  OPENAI_API_KEY: "sk-secret",
  SSH_AUTH_SOCK: "/tmp/agent.sock",
  NODE_OPTIONS: "--require /tmp/evil.js",
  APPDATA: "C:\\fake\\AppData\\Roaming",
};

describe("buildMcpEnv", () => {
  it("forwards only allowlisted variables", () => {
    expect(buildMcpEnv(parent, "linux")).toEqual({
      PATH: "/usr/bin:/bin",
      HOME: "/fake-home",
      TERM: "xterm-256color",
      NO_COLOR: "1",
      XDG_CONFIG_HOME: "/fake-home/.config",
      RPCEDGE_KEY: "rpcedge-key",
      RPCEDGE_RPC_URL: "https://rpc.example",
      SOLANA_RPC_URL: "https://solana.example",
      SOLANA_WS_URL: "wss://solana.example",
      YELLOWSTONE_GRPC_URL: "https://grpc.example",
    });
  });

  it("drops wallet, secret, and token variables on every platform", () => {
    for (const platform of ["linux", "darwin", "win32"] as const) {
      const env = buildMcpEnv(parent, platform);
      for (const key of Object.keys(env)) {
        expect(key).not.toMatch(/WALLET|SECRET|TOKEN|PRIVATE|SEED|SSH|NODE_OPTIONS|API_KEY/);
      }
      expect(Object.values(env)).not.toContain("ghp_secret");
    }
  });

  it("adds Windows basics only on win32", () => {
    expect(buildMcpEnv(parent, "darwin").APPDATA).toBeUndefined();
    expect(buildMcpEnv(parent, "win32").APPDATA).toBe("C:\\fake\\AppData\\Roaming");
  });

  it("omits unset variables", () => {
    expect(buildMcpEnv({ PATH: "/bin" }, "linux")).toEqual({ PATH: "/bin" });
  });

  it("keeps proxy and CA settings so the server works behind a corporate proxy", () => {
    const env = buildMcpEnv(
      {
        HTTPS_PROXY: "http://proxy.example:3128",
        no_proxy: "localhost",
        NODE_EXTRA_CA_CERTS: "/etc/ssl/corp.pem",
        NODE_OPTIONS: "--require /tmp/x.js",
      },
      "linux",
    );
    expect(env).toEqual({
      HTTPS_PROXY: "http://proxy.example:3128",
      no_proxy: "localhost",
      NODE_EXTRA_CA_CERTS: "/etc/ssl/corp.pem",
    });
  });
});
