# Publishing to npm

Packages: `rpcedge-core`, `rpcedge-sdk`, `rpcedge`, `rpcedge-mcp` (all public, MIT).

## One-time: npm token + GitHub secret

CI **cannot** enter a 2FA OTP. The token must be an **Automation** token (or a granular token with 2FA bypass for publish). A normal “Publish” token will fail with `ERR_PNPM_OTP_NON_INTERACTIVE` / “requires additional authentication”.

1. Sign in at [npmjs.com](https://www.npmjs.com/) (create an account if needed).
2. Enable 2FA on the account if npm requires it, then create a token:

   **Option A — Classic Automation (simplest for CI)**  
   [Access Tokens](https://www.npmjs.com/settings/~/tokens) → **Generate New Token** → **Classic** → type **Automation**  
   (Automation tokens skip OTP on publish.)

   **Option B — Granular**  
   **Granular Access Token** → Read and write packages → enable **bypass 2FA** / automation-style publish → allow creating new packages (first release).

3. Copy the token once (shown only once).
4. Store it on the repo (overwrites previous):

```bash
gh secret set NPM_TOKEN -R rpc-edge/rpcedge-toolkit
# paste when prompted
```

5. Confirm:

```bash
gh secret list -R rpc-edge/rpcedge-toolkit
# should list NPM_TOKEN
```

Optional local login (for manual publish from your machine):

```bash
npm login
npm whoami
```

## Release via GitHub Actions (recommended)

### A. Tag push

```bash
cd /Users/nyk/dev/rpcedge-toolkit
# bump if needed
node scripts/set-version.mjs 0.1.0
git add -A && git commit -m "chore: release v0.1.0"
git tag v0.1.0
git push origin main --tags
```

The **Release** workflow publishes with provenance on `v*` tags.

### B. Workflow dispatch

```bash
gh workflow run release.yml -R rpc-edge/rpcedge-toolkit \
  -f version=0.1.0 \
  -f dry_run=false
gh run watch -R rpc-edge/rpcedge-toolkit
```

Dry-run first:

```bash
gh workflow run release.yml -R rpc-edge/rpcedge-toolkit -f dry_run=true
```

## Manual publish (local)

```bash
export NODE_AUTH_TOKEN=npm_…   # or npm login
pnpm install && pnpm build && pnpm test
node scripts/publish.mjs --dry-run
node scripts/publish.mjs
```

Publish order is always: **core → sdk → cli → mcp**.

## After a successful publish

```bash
npx rpcedge@latest doctor
npx rpcedge-mcp@latest   # MCP stdio
pnpm add rpcedge-sdk
claude mcp add rpcedge -- npx rpcedge-mcp@latest
```

Update marketing site install snippets to prefer `npx` (clone remains fallback).

## Troubleshooting

| Error | Fix |
|---|---|
| `ENEEDAUTH` / 401 | Token missing or expired; re-run `gh secret set NPM_TOKEN` |
| `403` / need 2FA | Use automation token or enable OTP on publish |
| `EPUBLISHCONFLICT` | Version already on registry — bump with `set-version.mjs` |
| Provenance failed | Ensure `id-token: write` and GitHub-hosted runner (already in workflow) |
| Name taken | Unlikely for these names; rename package if npm 409 |

## Name ownership

Unscoped names (`rpcedge`, `rpcedge-sdk`, …) publish under the npm user that owns the token. Prefer a dedicated `rpc-edge` npm org later and migrate to `@rpcedge/*` if the brand needs multi-maintainer access control.
