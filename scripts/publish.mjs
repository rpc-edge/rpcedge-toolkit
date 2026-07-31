#!/usr/bin/env node
/**
 * Publish packages in dependency order.
 * Requires NODE_AUTH_TOKEN (or npm login) for registry.npmjs.org.
 *
 * CI must use an npm **granular** token with **Bypass 2FA = true** and write access.
 * (Classic tokens were removed Nov 2025.) Tokens without Bypass 2FA fail with EOTP.
 *
 * Usage:
 *   node scripts/publish.mjs           # real publish
 *   node scripts/publish.mjs --dry-run
 *   node scripts/publish.mjs --provenance  # optional Sigstore (needs OIDC + trusted publisher)
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";


const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const wantProvenance =
  process.argv.includes("--provenance") ||
  process.env.NPM_CONFIG_PROVENANCE === "true" ||
  process.env.PROVENANCE === "1";

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
    if (r.status === 1) {
      console.error(`
Publish failed.

If you saw EOTP / OTP errors:
  1. Create a granular token with Read+Write AND Bypass 2FA enabled
     https://www.npmjs.com/settings/~/tokens
     Docs: https://docs.npmjs.com/about-access-tokens#about-granular-access-tokens
  2. gh secret set NPM_TOKEN -R rpc-edge/rpcedge-toolkit
  3. Re-run: gh workflow run release.yml -R rpc-edge/rpcedge-toolkit

See docs/PUBLISH.md for the exact form fields.
`);
    }
    process.exit(r.status ?? 1);
  }
}

// Ensure npm/pnpm can auth: prefer NODE_AUTH_TOKEN already set by actions/setup-node
if (process.env.NODE_AUTH_TOKEN && !process.env.NPM_TOKEN) {
  process.env.NPM_TOKEN = process.env.NODE_AUTH_TOKEN;
}

// Build all packages first (workspace protocol intact)
console.log("Building packages…");
run("pnpm", ["build"]);

function packageVersion(name) {
  const pkg = JSON.parse(readFileSync(join(root, "packages", name, "package.json"), "utf8"));
  return pkg.version;
}

const coreVersion = packageVersion("core");

for (const dir of order) {
  const cwd = join(root, "packages", dir);
  const pkgPath = join(cwd, "package.json");
  const original = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(original);

  // Rewrite workspace deps so the published tarball depends on registry versions
  if (pkg.dependencies?.["rpcedge-core"]?.startsWith("workspace:")) {
    pkg.dependencies["rpcedge-core"] = `^${coreVersion}`;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  console.log(`\n=== publishing packages/${dir} (${pkg.name}@${pkg.version}) ===`);

  // --ignore-scripts: dist already built; avoid prepublishOnly re-resolving workspace deps
  const args = ["publish", "--access", "public", "--ignore-scripts"];
  if (dryRun) args.push("--dry-run");
  // Only request provenance when explicitly enabled (needs Trusted Publisher / OIDC)
  if (wantProvenance && !dryRun) args.push("--provenance");

  try {
    run("npm", args, { cwd });
  } finally {
    // restore workspace protocol for local monorepo
    writeFileSync(pkgPath, original);
  }
}

console.log(dryRun ? "\nDry-run complete." : "\nAll packages published.");
