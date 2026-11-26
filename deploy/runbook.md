# POWR operations runbook (skeleton)

Status: skeleton written in M0 (WP0.7). Spike S-7 fills in the server-specific values and
verifies every step. `<business-domain>` stays a placeholder until the product owner fills it in.
Technical concept: §7 (deployment view), §7.6 (operations), ADR-0011.

## 1. Overview

- One Hetzner Cloud VPS in Nuremberg (`nbg1`), Ubuntu 24.04 LTS, at least 2 vCPU / 4 GB RAM.
- Coolify 4.7 (self-hosted) with its Traefik proxy and Let's Encrypt certificates.
- Coolify project `powr` with two "Docker image" applications:
  - `beta`: `https://beta.<business-domain>`, deployed automatically from `main`.
  - `production`: `https://<production-domain>` (chosen after the trademark check V-05), deployed from a
    `vX.Y.Z` tag after approval in GitHub.
- The image is `ghcr.io/<owner>/powr-web:<version>-<sha7>` (and `:vX.Y.Z` for releases): the official
  `nginx:1.30-alpine` image, pinned to its digest (section 6.1), plus `apps/web/dist` and
  `deploy/nginx.conf`. It listens on port 8080 and answers the health check at `GET /version.json`.
  The image stays **private** on GHCR (section 2); the app it serves is public.
- The server holds **no user data**. Installed clients keep working offline during an outage.

## 2. GitHub configuration

Create two GitHub environments, `beta` and `production`. Add required reviewers to `production`.

| Kind     | Name                  | Value                                                                   | Scope             |
| -------- | --------------------- | ----------------------------------------------------------------------- | ----------------- |
| Secret   | `COOLIFY_API_URL`     | `https://coolify.<business-domain>`                                     | both environments |
| Secret   | `COOLIFY_TOKEN`       | Coolify API token with the **Deploy** permission only                   | both environments |
| Secret   | `COOLIFY_APP_UUID`    | UUID of the environment's Coolify application                           | per environment   |
| Secret   | `COOLIFY_WEBHOOK_URL` | The application's deploy webhook (`…/api/v1/deploy?uuid=…&force=false`) | per environment   |
| Variable | `APP_URL`             | `https://beta.<business-domain>` or the production URL                  | per environment   |
| Variable | `PUBLIC_ORIGIN`       | The **production** origin, e.g. `https://<production-domain>`           | repository        |

`PUBLIC_ORIGIN` is a **repository** variable, not an environment one: the CI build job reads it as
`VITE_PUBLIC_ORIGIN` (`.github/workflows/ci.yml`), and the image built there is promoted unchanged
to beta and production, so both run with the same origin, the production one (product-owner
decision 2026-11-25). It names the app in calendar UIDs (`<planned-session-id>@<host>`) and any
public URL. While it is unset, builds use the reserved `https://powr.invalid`, which calendar apps
accept. The product owner sets it once, when the production domain is chosen (after the trademark
check V-05); never change it afterwards, or exported calendar events stop updating and duplicate.

The workflows use the built-in `GITHUB_TOKEN` to push to GHCR; no personal token is stored.
Never put secret values into the repository.

**The GHCR image stays private.** The app itself is public: anyone can load its files from the
website, and its own licences and attributions ship with it. The container image is different: it
also contains the Alpine and nginx packages of the base image, several of them under the GPL
(busybox, apk-tools and others; `deploy/server-inventory.yaml`). Running them on our own server
distributes nothing, but making the image public would distribute those programs and bring the
GPL's duties (offering their exact source) with it (licence review §3, L-2). So:

- The `powr-web` package on GHCR is **Private**: check it after the first push of the deploy
  workflow, and again whenever the repository's or the organisation's settings change (GitHub →
  the repository → Packages → `powr-web` → Package settings; the "Danger Zone" there shows the
  visibility). Never use "Change visibility" to make it public, and do not link the package to
  a public repository.
- Coolify pulls with a **read-only** package token (section 3, step 7); nobody else needs access.
- Do not push the image, or a copy of it, to any other registry.

## 3. Server setup (spike S-7)

1. Create the VPS; attach a Hetzner Cloud Firewall: 22 from admin IPs only, 80 and 443 open.
2. SSH keys only: `PasswordAuthentication no`, `PermitRootLogin no`, a sudo user.
3. `unattended-upgrades` with an automatic reboot window (for example 04:00).
4. Docker log rotation in `/etc/docker/daemon.json`: `json-file`, `max-size 10m`, `max-file 3`.
5. Install Coolify (official installer, pinned 4.7.x); enable 2FA; switch telemetry off where offered;
   switch Coolify auto-update off.
6. DNS at the current provider: A/AAAA for `beta.<business-domain>` and `coolify.<business-domain>`;
   a CAA record allowing `letsencrypt.org`.
7. Coolify: add GHCR as a registry with a **read-only** package token; create the `powr` project with
   the `beta` application (image `ghcr.io/<owner>/powr-web`, port 8080, health check `/version.json`).
8. Confirm that Traefik writes no access log (inspect the generated proxy configuration).
9. Create the Deploy-only API token and copy the webhook URL into the GitHub secrets (section 2).
10. Configure the Coolify instance backup to S3-compatible storage outside the server.
11. Set up the external uptime monitor for `https://beta.<business-domain>/version.json` (5 min) and
    certificate expiry (OQ-T9: hosted free tier, preferably EU-based).

## 4. Routine deployments

- **Beta:** merge to `main`. CI builds and tests the image; `deploy.yml` pushes it to GHCR, points the
  beta application at the new tag (`deploy/coolify-deploy.sh`) and runs `deploy/wait-and-smoke.sh`.
- **Production:** bump `apps/web/package.json` version, tag `vX.Y.Z` on a commit that is already on
  beta, push the tag, approve the `production` environment. The beta image of that commit is retagged
  and deployed; it is never rebuilt. Before the tag (M6c):
  1. **Release notes** (NFR-MNT-07): write `docs/release-notes/<X.Y.Z>.md` (the format is described
     in `tools/release-notes/src/index.ts`; `pnpm release-notes` checks it), read it, set
     `reviewed: true`. The build fails when the app version has no notes; the production job's
     `pnpm release:check` fails while they are not reviewed. The seed notes are
     `docs/release-notes/0.0.0.md` (the beta): rename them to the release version.
  2. **Dependency audit** (NFR-SEC-01): `pnpm audit:prod` (the CI `audit` job runs it on every push,
     and the production job again on the tag). Severity policy: a **high or critical** advisory in a
     **production** dependency blocks the release until it is fixed (update, or an override in
     `pnpm-workspace.yaml`); **low and moderate** ones, and every advisory in a **build-only**
     package, are reported (`pnpm audit:all`, the `audit` artifact) and reviewed before each
     release, then fixed with the next routine update when a fix exists. Keep the release's
     `audit-prod.json` with its other artifacts. An advisory that cannot apply to POWR is ignored only
     with the product owner's written note (`pnpm audit --ignore <GHSA>` in the script, with the date
     and the reason).
  3. `pnpm release:check` passes locally (legal placeholders, release notes).
- After any deploy, open `https://<host>/legal-static/` once: the publisher details must match the
  app's Settings → Legal (`deploy/smoke.ts` checks the status, the headers and that the pages have no
  scripts).
- **Manual smoke test** of any environment: `node deploy/smoke.ts https://beta.<business-domain>`.

## 5. Rollback

- GitHub → Actions → **Rollback** → choose the environment and an existing image tag
  (for example `0.1.0-1a2b3c4` or `v0.1.0`). All release images stay in GHCR.
- Alternative: Coolify UI → application → Deployments → redeploy an earlier image.
- After a failed data migration, rolling back to the previous version is safe: its `sw.js` differs,
  clients install it as an update, and their database is still at the old version (§6.3).

## 6. Maintenance

| Task                                                                      | Cadence                                    |
| ------------------------------------------------------------------------- | ------------------------------------------ |
| Coolify upgrade after reading the release notes; Hetzner snapshot first   | Monthly; immediately for security releases |
| Update the pinned `nginx:1.30-alpine` digest (Dependabot opens a PR; 6.1) | Weekly check                               |
| Regenerate `deploy/server-inventory.yaml` from the new image (6.1)        | With every digest change, in the same PR   |
| Review `pnpm audit:all` (the CI `audit` artifact)                         | Before each release                        |
| Review firewall, SSH users and API tokens                                 | Quarterly                                  |
| Restore drill from this runbook (target: under 2 hours)                   | Once before launch, then yearly            |

### 6.1 Updating the base image digest

`deploy/Dockerfile` builds on `nginx:1.30-alpine@sha256:<digest>`: the tag says which line the
image follows, the digest fixes the exact image (the digest of the tag's multi-arch index, so it
resolves on amd64 and arm64 alike). A rebuild therefore uses exactly the packages that
`deploy/server-inventory.yaml` lists, and the image changes only through a reviewed PR. The
licence gate enforces the pairing: `pnpm licence` fails when the Dockerfile has no digest or when
its digest differs from `image.digest` in the inventory.

When a new digest is due (Dependabot's weekly Docker check opens a PR that changes the `FROM`
line; or by hand, for a security fix in the base image):

1. Read the new digest without pulling: `docker buildx imagetools inspect nginx:1.30-alpine` (the
   `Digest:` line of the index). After a `docker pull`, `docker image inspect nginx:1.30-alpine
   --format '{{index .RepoDigests 0}}'` shows the same value.
2. Put it into `deploy/Dockerfile`: `FROM nginx:1.30-alpine@sha256:<new digest>`.
3. Build the image and list its packages: `pnpm build && pnpm docker:build`, then
   `docker run --rm --entrypoint apk powr-web:local list --installed | sort`. CI does the same
   for the PR and saves the list as `image-packages.txt` in the `reports` artifact.
4. **Regenerate `deploy/server-inventory.yaml`** in the same PR: `image.digest` (the new digest),
   `image.read` (today), the Alpine and nginx versions in the comment above it, and the `packages`
   list (one entry per installed package: `name`, `version`, `origin` and `licence` as Alpine
   declares it). Never change the digest without the list, and never the list without the digest.
5. `pnpm licence` passes (the digests agree, no `serverDenied` licence), the image's header smoke
   test passes (`pnpm docker:run`, then `pnpm docker:smoke`; CI runs both), and a new licence in
   the list is looked at against licence review §3.
6. Merge; beta and production follow as usual (section 4).

Moving to another tag (for example the next nginx stable line) is the same change with the new
tag in both files, plus a line in the release notes.

## 7. Incident: server down

1. Installed clients are unaffected; only first visits, installs and update checks fail.
2. Check the Hetzner console; restart the VPS or restore the latest snapshot.
3. If the server is lost: new VPS → steps of section 3 → restore the Coolify backup → DNS → redeploy the
   last good tag with the Rollback workflow.
4. Post an incident note if users were affected.

## 8. Open items (fill in during S-7)

- [ ] `<business-domain>` (product owner).
- [ ] Hetzner server type and IPs; firewall admin IPs.
- [ ] Coolify version installed and backup target.
- [ ] Uptime monitor service.
- [ ] Verified: Traefik access log off, Docker log rotation, health check, webhook from Actions,
      rollback, restore drill.
