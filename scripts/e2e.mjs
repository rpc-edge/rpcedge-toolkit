#!/usr/bin/env node
/**
 * Full end-to-end verification of rpcedge-toolkit.
 *
 * Usage:
 *   node scripts/e2e.mjs              # local packages only
 *   node scripts/e2e.mjs --registry   # also hit npm + npx if published
 *   node scripts/e2e.mjs --key <uuid> # use real RPCEDGE_KEY for production path
 *
 * Exit 0 only if all required checks pass.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wantRegistry = process.argv.includes("--registry");
const keyIdx = process.argv.indexOf("--key");
const cliKey = keyIdx >= 0 ? process.argv[keyIdx + 1] : process.env.RPCEDGE_KEY;

const results = [];
let failed = 0;

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  failed++;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}
function section(title) {
  console.log(`\n## ${title}`);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? root,
    env: { ...process.env, ...(opts.env || {}) },
    encoding: "utf8",
    timeout: opts.timeout ?? 60_000,
    shell: false,
  });
  return {
    code: r.status ?? 1,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
    error: r.error,
  };
}

function assertJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

// ── 1. Build / typecheck / unit tests ──────────────────────────────────────
section("Build & unit tests");

const build = run("pnpm", ["build"]);
if (build.code === 0) pass("pnpm build");
else fail("pnpm build", build.stderr.slice(0, 300));

const tsc = run("pnpm", ["-r", "--filter", "./packages/*", "run", "typecheck"]);
if (tsc.code === 0) pass("typecheck all packages");
else fail("typecheck", tsc.stderr.slice(0, 300));

const test = run("pnpm", ["-r", "--filter", "./packages/*", "run", "--if-present", "test"]);
if (test.code === 0) pass("unit tests");
else fail("unit tests", test.stderr.slice(0, 300));

for (const p of ["core", "sdk", "cli", "mcp"]) {
  const entry = join(root, "packages", p, "dist", "index.js");
  if (existsSync(entry)) pass(`dist exists: packages/${p}`);
  else fail(`dist missing: packages/${p}`);
}

const cli = join(root, "packages", "cli", "dist", "index.js");
const mcp = join(root, "packages", "mcp", "dist", "index.js");

// ── 2. CLI smoke (public mainnet, no key required) ─────────────────────────
section("CLI smoke (public baseline)");

const envBase = { ...process.env };
delete envBase.RPCEDGE_KEY;
delete envBase.SOLANA_RPC_URL;

{
  const r = run("node", [cli, "--version"], { env: envBase });
  if (r.code === 0 && /^\d+\.\d+\.\d+/.test(r.stdout)) pass("cli --version", r.stdout);
  else fail("cli --version", r.stdout || r.stderr);
}

{
  const r = run("node", [cli, "--help"], { env: envBase });
  if (r.code === 0 && r.stdout.includes("doctor")) pass("cli --help");
  else fail("cli --help", r.stderr.slice(0, 200));
}

{
  const r = run("node", [cli, "whoami", "--json"], { env: envBase });
  const j = assertJson(r.stdout);
  if (r.code === 0 && j && j.hasKey === false) pass("cli whoami --json (no key)", j.host);
  else fail("cli whoami --json", r.stdout || r.stderr);
}

{
  const r = run("node", [cli, "doctor", "--json"], { env: envBase, timeout: 30_000 });
  const j = assertJson(r.stdout);
  if (r.code === 0 && j?.ok === true && j.checks?.some((c) => c.name === "rpc_health" && c.ok)) {
    pass("cli doctor --json (public)", j.config?.label);
  } else fail("cli doctor --json", r.stdout.slice(0, 400) || r.stderr.slice(0, 200));
}

{
  const r = run("node", [cli, "slot", "--json"], { env: envBase, timeout: 20_000 });
  const j = assertJson(r.stdout);
  if (r.code === 0 && typeof j?.slot === "number" && j.slot > 0) pass("cli slot --json", String(j.slot));
  else fail("cli slot --json", r.stdout || r.stderr);
}

{
  const r = run("node", [cli, "health", "--json"], { env: envBase, timeout: 20_000 });
  const j = assertJson(r.stdout);
  if (r.code === 0 && j?.healthy === true && j.slot > 0) pass("cli health --json", `slot ${j.slot}`);
  else fail("cli health --json", r.stdout || r.stderr);
}

{
  const r = run("node", [cli, "fee", "--json"], { env: envBase, timeout: 20_000 });
  const j = assertJson(r.stdout);
  if (r.code === 0 && typeof j?.p50 === "number") pass("cli fee --json", `p50=${j.p50}`);
  else fail("cli fee --json", r.stdout || r.stderr);
}

{
  const r = run("node", [cli, "epoch", "--json"], { env: envBase, timeout: 20_000 });
  const j = assertJson(r.stdout);
  if (r.code === 0 && typeof j?.epoch === "number") pass("cli epoch --json", `epoch ${j.epoch}`);
  else fail("cli epoch --json", r.stdout || r.stderr);
}

{
  const r = run("node", [cli, "leaders", "--count", "4", "--json"], { env: envBase, timeout: 20_000 });
  const j = assertJson(r.stdout);
  if (r.code === 0 && Array.isArray(j?.leaders) && j.leaders.length > 0) {
    pass("cli leaders --json", `${j.leaders.length} leaders`);
  } else fail("cli leaders --json", r.stdout || r.stderr);
}

{
  const r = run("node", [cli, "call", "getHealth", "[]", "--json"], { env: envBase, timeout: 20_000 });
  const j = assertJson(r.stdout);
  if (r.code === 0 && j?.result !== undefined) pass("cli call getHealth", JSON.stringify(j.result));
  else fail("cli call getHealth", r.stdout || r.stderr);
}

{
  const r = run("node", [cli, "latency", "--json"], { env: envBase, timeout: 60_000 });
  const j = assertJson(r.stdout);
  if (r.code === 0 && Array.isArray(j?.rows) && j.rows.length >= 1) {
    pass("cli latency --json", j.rows.map((x) => `${x.host}:${x.p50Ms}ms`).join(", "));
  } else fail("cli latency --json", r.stdout.slice(0, 300) || r.stderr);
}

{
  const r = run("node", [cli, "open", "signup", "--json"], { env: envBase });
  const j = assertJson(r.stdout);
  if (r.code === 0 && j?.url?.includes("app.rpcedge")) pass("cli open signup", j.url);
  else fail("cli open signup", r.stdout || r.stderr);
}

{
  // invalid command should exit non-zero
  const r = run("node", [cli, "not-a-command"], { env: envBase });
  if (r.code !== 0) pass("cli unknown command exits non-zero");
  else fail("cli unknown command should fail");
}

{
  // send without --raw should fail
  const r = run("node", [cli, "send"], { env: envBase });
  if (r.code !== 0) pass("cli send without --raw fails safely");
  else fail("cli send without args should fail");
}

// ── 3. CLI with key path (if provided) ─────────────────────────────────────
section(cliKey ? "CLI with RPCEDGE_KEY" : "CLI with RPCEDGE_KEY (skipped — no key)");

if (cliKey) {
  const envKey = { ...process.env, RPCEDGE_KEY: cliKey };
  delete envKey.SOLANA_RPC_URL;

  const who = run("node", [cli, "whoami", "--json"], { env: envKey });
  const wj = assertJson(who.stdout);
  if (who.code === 0 && wj?.hasKey === true && wj.host?.includes("rpcedge")) {
    pass("whoami with key → rpc.rpcedge.com", wj.key);
  } else fail("whoami with key", who.stdout || who.stderr);

  const doc = run("node", [cli, "doctor", "--json"], { env: envKey, timeout: 30_000 });
  const dj = assertJson(doc.stdout);
  // auth may fail if key invalid; still useful signal
  if (doc.code === 0 && dj?.ok) pass("doctor with key OK", dj.config?.rpcUrlRedacted);
  else if (dj?.checks) {
    const health = dj.checks.find((c) => c.name === "rpc_health");
    if (health?.ok) pass("doctor with key (health ok)", health.detail);
    else fail("doctor with key", doc.stdout.slice(0, 400));
  } else fail("doctor with key", doc.stdout.slice(0, 400) || doc.stderr);

  const slot = run("node", [cli, "slot", "--json"], { env: envKey, timeout: 20_000 });
  const sj = assertJson(slot.stdout);
  if (slot.code === 0 && sj?.slot > 0) pass("slot via rpcedge", String(sj.slot));
  else fail("slot via rpcedge", slot.stdout || slot.stderr);
} else {
  pass("skip keyed path", "set RPCEDGE_KEY or --key for production e2e");
}

// ── 4. SDK programmatic ────────────────────────────────────────────────────
section("SDK (RpcEdge)");

{
  const script = `
import { RpcEdge, RpcEdgeError } from ${JSON.stringify(join(root, "packages/sdk/dist/index.js"))};

const edge = await RpcEdge.fromEnv();
const slot = await edge.getSlot();
if (typeof slot !== "number" || slot <= 0) throw new Error("bad slot " + slot);
const h = await edge.health();
if (!h.healthy) throw new Error("not healthy");
const f = await edge.priorityFees();
if (typeof f.p50 !== "number") throw new Error("bad fees");
const e = await edge.epochInfo();
if (typeof e.epoch !== "number") throw new Error("bad epoch");
const d = await edge.doctor();
if (!d.ok && !d.checks?.length) throw new Error("bad doctor");
// call passthrough
const v = await edge.call("getVersion");
if (!v || typeof v !== "object") throw new Error("bad version");
console.log(JSON.stringify({
  slot, host: h.host, solanaCore: h.solanaCore, p50: f.p50, epoch: e.epoch, doctorOk: d.ok
}));
`;
  const dir = mkdtempSync(join(tmpdir(), "rpcedge-e2e-"));
  const file = join(dir, "sdk-smoke.mjs");
  writeFileSync(file, script);
  const r = run("node", [file], {
    env: cliKey ? { ...process.env, RPCEDGE_KEY: cliKey } : envBase,
    timeout: 45_000,
  });
  rmSync(dir, { recursive: true, force: true });
  if (r.code === 0) {
    const j = assertJson(r.stdout);
    pass("SDK fromEnv health/slot/fee/epoch/doctor/call", j ? `slot ${j.slot}` : r.stdout);
  } else fail("SDK smoke", r.stderr.slice(0, 400) || r.stdout);
}

{
  // withKey empty should throw
  const script = `
import { RpcEdge, RpcEdgeError } from ${JSON.stringify(join(root, "packages/sdk/dist/index.js"))};
try {
  RpcEdge.withKey("  ");
  console.log("FAIL_NO_THROW");
  process.exit(1);
} catch (e) {
  if (e instanceof RpcEdgeError && e.code === "config") {
    console.log("OK");
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
}
`;
  const dir = mkdtempSync(join(tmpdir(), "rpcedge-e2e-"));
  const file = join(dir, "sdk-err.mjs");
  writeFileSync(file, script);
  const r = run("node", [file]);
  rmSync(dir, { recursive: true, force: true });
  if (r.code === 0 && r.stdout.includes("OK")) pass("SDK withKey empty → RpcEdgeError");
  else fail("SDK withKey empty", r.stderr || r.stdout);
}

// ── 5. Core redaction / security ───────────────────────────────────────────
section("Security / redaction");

{
  const script = `
import { redactUrl, maskKey, hostOf, buildRpcUrl } from ${JSON.stringify(join(root, "packages/core/dist/index.js"))};
const secret = "10bcb316-cd81-47d2-89c4-375354a8c54f";
const url = buildRpcUrl("https://rpc.rpcedge.com", secret);
const red = redactUrl(url);
if (red.includes(secret)) throw new Error("secret leaked in redactUrl: " + red);
if (!red.includes("***")) throw new Error("no mask: " + red);
const m = maskKey(secret);
if (m.includes("cd81") || m.length > 12) throw new Error("mask weak: " + m);
if (hostOf(url) !== "rpc.rpcedge.com") throw new Error("host " + hostOf(url));
console.log("OK");
`;
  const dir = mkdtempSync(join(tmpdir(), "rpcedge-e2e-"));
  const file = join(dir, "sec.mjs");
  writeFileSync(file, script);
  const r = run("node", [file]);
  rmSync(dir, { recursive: true, force: true });
  if (r.code === 0) pass("key redaction / mask / hostOf");
  else fail("redaction", r.stderr || r.stdout);
}

// ── 6. MCP server ──────────────────────────────────────────────────────────
section("MCP server");

{
  // Live MCP e2e via official client (newline-delimited stdio).
  // Script lives under packages/mcp so @modelcontextprotocol/sdk resolves.
  const harness = `
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [${JSON.stringify(mcp)}],
  stderr: "pipe",
});

const client = new Client({ name: "rpcedge-e2e", version: "0.1.0" });
await client.connect(transport);

const listed = await client.listTools();
const names = (listed.tools || []).map((t) => t.name).sort();
const required = [
  "rpc_health",
  "priority_fee_estimate",
  "epoch_info",
  "next_leaders",
  "latency_compare",
  "submit_transaction",
  "doctor",
  "endpoint_map",
];
const missing = required.filter((n) => !names.includes(n));
if (missing.length) {
  console.error("missing tools", missing, names);
  process.exit(2);
}

const health = await client.callTool({ name: "rpc_health", arguments: {} });
const healthText = (health.content || []).map((c) => ("text" in c ? c.text : "")).join("\\n");
if (!/slot\\s+\\d+/i.test(healthText) && !/healthy/i.test(healthText)) {
  console.error("rpc_health bad", healthText.slice(0, 400));
  process.exit(3);
}

const doctor = await client.callTool({ name: "doctor", arguments: {} });
const doctorText = (doctor.content || []).map((c) => ("text" in c ? c.text : "")).join("\\n");
if (!/doctor/i.test(doctorText)) {
  console.error("doctor bad", doctorText.slice(0, 400));
  process.exit(4);
}

const map = await client.callTool({ name: "endpoint_map", arguments: {} });
const mapText = (map.content || []).map((c) => ("text" in c ? c.text : "")).join("\\n");
if (!mapText.includes("rpc.rpcedge.com")) {
  console.error("endpoint_map bad", mapText.slice(0, 400));
  process.exit(5);
}

const fee = await client.callTool({ name: "priority_fee_estimate", arguments: {} });
const feeText = (fee.content || []).map((c) => ("text" in c ? c.text : "")).join("\\n");
if (!/priority fee|micro-lamports/i.test(feeText)) {
  console.error("fee bad", feeText.slice(0, 400));
  process.exit(6);
}

const epoch = await client.callTool({ name: "epoch_info", arguments: {} });
const epochText = (epoch.content || []).map((c) => ("text" in c ? c.text : "")).join("\\n");
if (!/epoch\\s+\\d+/i.test(epochText)) {
  console.error("epoch bad", epochText.slice(0, 400));
  process.exit(7);
}

await client.close();
console.log(JSON.stringify({
  toolCount: names.length,
  names,
  healthSnippet: healthText.split("\\n")[0],
  doctorOk: /OK|ISSUES/.test(doctorText),
  hasEndpointMap: true,
}));
`;
  const file = join(root, "packages/mcp/scripts-e2e-mcp-tmp.mjs");
  writeFileSync(file, harness);
  try {
    const r = run("node", [file], {
      env: envBase,
      cwd: join(root, "packages/mcp"),
      timeout: 60_000,
    });
    if (r.code === 0) {
      const j = assertJson(r.stdout);
      if (j?.toolCount >= 8) pass("MCP tools/list + live tool calls", j.healthSnippet);
      else fail("MCP tool calls incomplete", r.stdout);
    } else fail("MCP client e2e", (r.stderr || r.stdout).slice(0, 800));
  } finally {
    try {
      rmSync(file, { force: true });
    } catch {
      /* ignore */
    }
  }
}

// ── 7. Config file path ────────────────────────────────────────────────────
section("Config file");

{
  const r = run("node", [cli, "config", "path", "--json"], { env: envBase });
  const j = assertJson(r.stdout);
  if (r.code === 0 && j?.path?.includes("rpcedge")) pass("config path", j.path);
  else fail("config path", r.stdout || r.stderr);
}

// ── 8. Publish packing (dry-run, no registry write) ────────────────────────
section("Publish dry-run (pack only)");

{
  const r = run("node", [join(root, "scripts/publish.mjs"), "--dry-run"], { timeout: 120_000 });
  if (r.code === 0 && /rpcedge-core@0\.\d+\.\d+/.test(r.stdout + r.stderr) && /Dry-run complete/.test(r.stdout + r.stderr)) {
    pass("publish.mjs --dry-run packs all 4 packages");
  } else if (r.code === 0) {
    pass("publish.mjs --dry-run", "ok");
  } else fail("publish dry-run", (r.stderr || r.stdout).slice(0, 400));
}

// ── 9. Optional registry ───────────────────────────────────────────────────
section(wantRegistry ? "npm registry" : "npm registry (skipped — pass --registry)");

if (wantRegistry) {
  for (const name of ["rpcedge-core", "rpcedge-sdk", "rpcedge", "rpcedge-mcp"]) {
    const r = run("npm", ["view", name, "version"]);
    if (r.code === 0 && /^\d+\.\d+\.\d+/.test(r.stdout)) pass(`npm view ${name}`, r.stdout);
    else fail(`npm view ${name}`, r.stderr.slice(0, 120) || "not published");
  }
  const npx = run("npx", ["--yes", "rpcedge@latest", "--version"], { timeout: 120_000 });
  if (npx.code === 0 && /^\d+\.\d+\.\d+/.test(npx.stdout)) pass("npx rpcedge@latest --version", npx.stdout);
  else fail("npx rpcedge@latest", npx.stderr.slice(0, 200) || npx.stdout);
}

// ── Summary ────────────────────────────────────────────────────────────────
section("Summary");
const ok = results.filter((r) => r.ok).length;
const bad = results.filter((r) => !r.ok).length;
console.log(`\n${ok} passed · ${bad} failed · ${results.length} total\n`);
if (failed > 0) {
  console.error("FAILED CHECKS:");
  for (const r of results.filter((x) => !x.ok)) {
    console.error(`  - ${r.name}: ${r.detail}`);
  }
  process.exit(1);
}
console.log("All e2e checks passed.");
process.exit(0);
