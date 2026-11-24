#!/usr/bin/env bash
# Waits until the deployed version answers (Coolify switches after its health check), then runs
# the header and caching smoke test. Usage: wait-and-smoke.sh <app-url> [expected-build]
set -euo pipefail

url="${1:?usage: wait-and-smoke.sh <app-url> [expected-build]}"
build="${2:-}"

for _ in $(seq 1 60); do
  if [ -z "${build}" ] || curl -fs "${url%/}/version.json" | grep -q "\"build\":\"${build}\""; then
    break
  fi
  sleep 5
done

if [ -n "${build}" ]; then
  node deploy/smoke.ts "${url}" --expect-build "${build}"
else
  node deploy/smoke.ts "${url}"
fi
