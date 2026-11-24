# POWR web image (ADR-0011): the official nginx stable image plus the built app.
# Build from the repository root after `pnpm build`:
#   docker build -f deploy/Dockerfile -t powr-web:local .
FROM nginx:1.30-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY apps/web/dist/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/version.json || exit 1
