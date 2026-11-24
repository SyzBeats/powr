#!/usr/bin/env bash
# Sets the image tag of a Coolify "Docker image" application and triggers its deploy webhook
# (technical concept §7.5). Needs COOLIFY_API_URL, COOLIFY_TOKEN, COOLIFY_APP_UUID and
# COOLIFY_WEBHOOK_URL; see deploy/runbook.md. The token needs the Deploy permission only.
set -euo pipefail

tag="${1:?usage: coolify-deploy.sh <image-tag>}"
: "${COOLIFY_API_URL:?}" "${COOLIFY_TOKEN:?}" "${COOLIFY_APP_UUID:?}" "${COOLIFY_WEBHOOK_URL:?}"

curl --fail-with-body --silent --show-error \
  --request PATCH "${COOLIFY_API_URL%/}/api/v1/applications/${COOLIFY_APP_UUID}" \
  --header "Authorization: Bearer ${COOLIFY_TOKEN}" \
  --header "Content-Type: application/json" \
  --data "{\"docker_registry_image_tag\":\"${tag}\"}"
echo

curl --fail-with-body --silent --show-error \
  --header "Authorization: Bearer ${COOLIFY_TOKEN}" \
  "${COOLIFY_WEBHOOK_URL}"
echo
