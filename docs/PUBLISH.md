# Publishing to npm

Packages: `rpcedge-core`, `rpcedge-sdk`, `rpcedge`, `rpcedge-mcp` (all public, MIT).

## One-time: npm granular token + GitHub secret

As of **November 2025**, npm only supports **[granular access tokens](https://docs.npmjs.com/about-access-tokens#about-granular-access-tokens)**. Classic / legacy “Automation” tokens are gone.

CI **cannot** enter a 2FA OTP. A granular token **without** Bypass 2FA fails with:

```text
npm error code EOTP
This operation requires a one-time password from your authenticator.
```

### Create the token (exact settings)

1. Sign in at [npmjs.com](https://www.npmjs.com/).
2. Open **[Access Tokens](https://www.npmjs.com/settings/~/tokens)** → **Generate New Token** → **Granular Access Token**.
3. Configure:

| Field | Value for this repo |
|---|---|
| **Token name** | `rpcedge-toolkit-ci` (or similar) |
| **Expiration** | e.g. 90 days (min 1 day) |
| **Packages and scopes** | **All packages** *or* specifically `rpcedge-core`, `rpcedge-sdk`, `rpcedge`, `rpcedge-mcp` |
| **Permissions** | **Read and write** (not read-only) |
| **Bypass 2FA** | **Must be true / enabled** |
| **Organizations** | only if you later move packages under an npm org (not required for first user-scoped publish) |
| **IP ranges** | leave empty unless you lock CI to known egress IPs |

**Bypass 2FA** is the load-bearing setting. From the [npm docs](https://docs.npmjs.com/about-access-tokens#about-granular-access-tokens):

> When Bypass 2FA is true, this setting takes precedence over account-level and package-level 2FA. Even if account 2FA is on and/or package-level 2FA is required, 2FA is still bypassed when using the token.

Only enable Bypass 2FA on a token stored as a CI secret — never paste it into chat, commits, or public issues.

**First publish note:** if the four package names do not exist yet, the token needs permission to **publish new packages** under your user (select all packages / unrestricted package selection for the first release, then tighten later).

4. Generate, **copy once**.
5. Store on the GitHub repo (overwrites previous):

```bash
gh secret set NPM_TOKEN -R rpc-edge/rpcedge-toolkit
# paste when prompted — do not echo the token
```

6. Confirm secret exists (value is never shown):

```bash
gh secret list -R rpc-edge/rpcedge-toolkit
# should list NPM_TOKEN
```

Optional local login (interactive 2FA is fine on your machine):

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
