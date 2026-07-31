#!/usr/bin/env node
/**
 * Publish packages in dependency order.
 * Requires NODE_AUTH_TOKEN (or npm login) for registry.npmjs.org.
 *
 * Usage:
 *   node scripts/publish.mjs           # real publish
 *   node scripts/publish.mjs --dry-run
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

// core first (workspace deps resolve to published versions via pnpm)
const order = ["core", "sdk", "cli", "mcp"];

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? root,
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

// Ensure dist exists
for (const dir of order) {
  const dist = join(root, "packages", dir, "dist", "index.js");
  if (!existsSync(dist)) {
    console.log("dist missing — running build…");
    run("pnpm", ["build"]);
    break;
  }
}

const publishArgs = ["publish", "--access", "public", "--no-git-checks"];
if (dryRun) publishArgs.push("--dry-run");
// Provenance only works on supported CI with id-token
if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
  publishArgs.push("--provenance");
}

for (const dir of order) {
  const cwd = join(root, "packages", dir);
  console.log(`\n=== publishing packages/${dir} ===`);
  run("pnpm", publishArgs, { cwd });
}

console.log(dryRun ? "\nDry-run complete." : "\nAll packages published.");
