# POWR web image (ADR-0011): the official nginx stable image plus the built app.
# Build from the repository root after `pnpm build`:
#   docker build -f deploy/Dockerfile -t powr-web:local .
#
# The base image is pinned to the digest of the tag's multi-arch index, so every build uses
# exactly the image whose packages deploy/server-inventory.yaml lists. Change it only on purpose
# (runbook §6.1): a new digest here always comes with a regenerated deploy/server-inventory.yaml
# (`pnpm licence` fails while the two digests differ).
FROM nginx:1.30-alpine@sha256:8eb04fe3b385090e9aa02961f77398ad09b6bf33ab07f6669a5bb7acce22c0d3

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY apps/web/dist/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/version.json || exit 1
