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
  `nginx:1.30-alpine` image plus `apps/web/dist` and `deploy/nginx.conf`. It listens on port 8080 and
  answers the health check at `GET /version.json`.
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
  and deployed; it is never rebuilt.
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
| Rebuild the image for `nginx:1.30-alpine` updates (Dependabot opens a PR) | Weekly check                               |
| Review firewall, SSH users and API tokens                                 | Quarterly                                  |
| Restore drill from this runbook (target: under 2 hours)                   | Once before launch, then yearly            |

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
