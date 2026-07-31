import { describe, it, expect } from "vitest";
import { buildRpcUrl, hostOf, maskKey, redactUrl } from "./endpoints.js";

describe("endpoints", () => {
  it("hostOf strips path and query", () => {
    expect(hostOf("https://rpc.rpcedge.com?key=secret")).toBe("rpc.rpcedge.com");
  });

  it("redactUrl masks key query", () => {
    expect(redactUrl("https://rpc.rpcedge.com?key=uuid-here")).toContain("key=***");
    expect(redactUrl("https://rpc.rpcedge.com?key=uuid-here")).not.toContain("uuid-here");
  });

  it("buildRpcUrl appends key", () => {
    expect(buildRpcUrl("https://rpc.rpcedge.com", "abc")).toBe(
      "https://rpc.rpcedge.com/?key=abc",
    );
  });

  it("maskKey keeps edges only", () => {
    expect(maskKey("10bcb316-cd81-47d2-89c4-375354a8c54f")).toMatch(/^10bc…c54f$/);
  });
});
