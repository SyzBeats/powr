# ADR-0011: Hosting: Hetzner Cloud VPS (Germany) with self-hosted Coolify

- Status: Accepted (product-owner decision 2026-11-24, OQ-T2; supersedes the v0.1 proposal "Infomaniak web hosting"; set-up validated in spike S-7)
- Date: 2026-11-23, rewritten 2026-11-24
- Related: technical concept §7 (deployment view), §8.18, §11 (T-14, T-15); PRD NFR-SEC-01, NFR-PRIV-02/06, LEG-02, LEG-09, C-11, C-13, TC-12, R-17, R-18

## Context

The app is a set of static files; there is no backend. The serving set-up must provide:

- HTTPS with full control of response headers: CSP, HSTS, `no-cache` for `sw.js` and the manifest, `immutable` for hashed assets;
- a SPA fallback for deep links;
- separate beta and production channels;
- minimal, disclosed request logging (NFR-PRIV-06);
- low cost.

v0.1 proposed Infomaniak (Switzerland) with Cloudflare Pages as runner-up. On 2026-11-24 the product owner chose a different option: **a Hetzner Cloud VPS in an EU location running self-hosted Coolify**.

Facts checked 2026-11-24:

- **Hetzner Cloud:** locations Germany (Falkenstein, Nuremberg), Finland (Helsinki), Singapore and the USA; shared-vCPU plans from € 5.49/month excl. VAT; free stateful cloud firewalls [hetzner.com/cloud].
- **Coolify:** open source, **Apache-2.0**, self-hosted. Latest v4.7.6 (2026-11-19), very active (v4.7.0–4.7.6 in November 2026), about 66,000 GitHub stars [GitHub API].
  - Minimum server: 2 cores, 2 GB RAM, 10 GB disk; Ubuntu LTS supported [Coolify installation docs].
  - Default proxy **Traefik** (new configurations use v3.7), with Caddy as an alternative; Coolify generates TLS settings [Coolify proxy docs].
  - The Static build pack serves files with nginx, with a UI-editable config baked in at image build [Coolify static docs].
  - Recommended CI flow: build in GitHub Actions, push to a registry, then `POST` the application's deploy webhook with a bearer token that has the Deploy permission [Coolify GitHub Actions docs].
  - Rollback redeploys a retained image (`POST /applications/{uuid}/rollback`) [Coolify rollback docs].
- **nginx** 1.30.x is the stable branch (1.30.8, 2026-11-23, BSD-2-Clause). **Traefik** is MIT.

## Options considered

The v0.1 criteria are kept, except that "privacy and jurisdiction" now also covers **control over request logs**, which matters for the privacy notice.

| Criterion (weight) | **Hetzner VPS + Coolify (EU)** | Cloudflare Pages (US) | Infomaniak web hosting (CH) | Bunny.net Storage + CDN (EU) |
|---|---|---|---|---|
| Privacy: jurisdiction and log control (4) | 5 (EU; the publisher controls the whole HTTP path; logs can be switched off) | 2 | 4 (Swiss; logs controlled by the host) | 4 (EU; anonymized 3-day logs) |
| Header control: CSP, HSTS, cache (3) | 5 (version-controlled `nginx.conf`) | 5 | 5 | 4 |
| Atomic deploys and rollback (2) | 5 (container swap after health check; immutable images) | 5 | 3 | 3 |
| Cost (1) | 4 | 5 | 4 | 5 |
| Operational simplicity (2) | 2 (the publisher runs a server) | 5 | 3 | 3 |
| Performance (1) | 4 | 5 | 3 | 5 |
| **Total (max 65)** | **57** | 53 | 50 | 50 |

(Infomaniak scored 54 in v0.1 under the narrower privacy criterion; with log control included it drops to 50.)

## Decision

1. **Server:** Hetzner Cloud VPS, location **Nuremberg (`nbg1`), Germany** (Falkenstein equivalent; Germany is preferred over Helsinki because it is closer to the publisher and to most users in Switzerland and central Europe, with the same jurisdiction and price), shared vCPU with **≥ 2 vCPU / 4 GB RAM**, Ubuntu 24.04 LTS, Hetzner Cloud Firewall in front.
2. **Platform:** self-hosted **Coolify 4.7**. One project `powr` with environments `beta` and `production`, each a "Docker image" application.
3. **TLS and routing:** Coolify's default **Traefik** proxy with automatic **Let's Encrypt** certificates and HTTP→HTTPS redirect.
4. **Serving:** an **own nginx image built in CI** (`nginx:1.30-alpine` + `dist/` + `deploy/nginx.conf` with all headers, cache rules, SPA fallback and `access_log off`). Runner-up: Coolify's Static build pack, rejected because its nginx config lives in the Coolify UI rather than in version control, and Coolify would build on the server instead of deploying the tested artifact.
5. **CI/CD:** GitHub Actions builds and tests, pushes immutable tags to the private GitHub Container Registry, then calls the Coolify deploy webhook (Deploy-only API token).
   - Beta deploys automatically from `main`.
   - Production deploys on tag `vX.Y.Z` after GitHub environment approval, promoting the already-tested image.
   - Runner-up: Coolify's GitHub App integration, rejected because it rebuilds from source on the server.
6. **Rollback:** Coolify rollback or the `rollback.yml` workflow redeploying an earlier GHCR tag.
7. **Logging:** no access logs (nginx `access_log off`, Traefik access log disabled), Docker log rotation, Coolify telemetry off where offered.
8. **Operations:** server hardening, Coolify updates, configuration backups, uptime monitoring and DNS are the publisher's responsibility, as listed in technical concept §7.6.

**Privacy story:** "EU hosting, Swiss publisher". The privacy notice names Hetzner Online GmbH (Germany) as infrastructure provider, states that the publisher operates the server and keeps no access logs, and that training data never reaches the server. A data-processing agreement with Hetzner is concluded. Applicability of revFADP/GDPR to the remaining transient connection data is confirmed in legal review (V-06).

## Consequences

- Positive: full control of headers and logs; the deployed artifact is exactly the tested image; atomic deploys and one-step rollback; low cost; EU jurisdiction.
- Negative: the publisher now runs a server (risk T-15). This is mitigated by the runbook, hardening, monthly Coolify updates with snapshots, 2FA, Deploy-only tokens, and the fact that the server holds no user data.
- Negative: a single VPS is a single point of failure (risk T-14). The impact is limited because installed clients run offline from the service-worker cache; an outage blocks only first visits, installs and updates. An EU CDN or a second VPS can be added later.
- Negative: the Swiss-hosting argument of v0.1 is gone. The privacy claims rest on the architecture (no data leaves the device, CSP `connect-src 'self'`, no access logs), not on the host's country.
- Follow-ups: spike S-7 (provisioning, hardening, Traefik log check, deploy webhook, rollback, Coolify backup to S3-compatible storage, restore drill); uptime monitoring resolved 2026-11-24 (OQ-T9: hosted free-tier monitor, preferably EU-based, chosen in S-7); DNS resolved 2026-11-24 (OQ-T11: stays at the current provider; `beta.`, `coolify.` and CAA records; business-domain name filled in by the product owner in S-7/WP0.7).

## Amendment (v0.9, 2026-11-25)

The decision stands. Two additions (technical concept §7.5, §7.8):

- **One public origin (product-owner decision of 2026-11-25).** The app has one configured public origin for calendar UIDs and public URLs, `VITE_PUBLIC_ORIGIN`, read at build time (default `https://powr.invalid`). Because the image is built once in CI and promoted unchanged from beta to production, it is the **production** origin for both: `ci.yml` reads it from the repository variable `PUBLIC_ORIGIN`, which the product owner sets once the production domain is chosen (after V-05) and never changes afterwards (`deploy/runbook.md` §2).
- **Legal release gate.** The production job runs `pnpm release:check` before the image is promoted: it fails while the publisher's postal address or the legal-review date is still a placeholder (V-05, V-06).

Source: `IMPLEMENTATION_NOTES.md` (repository root), sections "M5s settings, legal and explainability" and "M5z bundle trim, fixes and docs".
