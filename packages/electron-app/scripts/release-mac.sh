#!/usr/bin/env bash

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${APP_DIR}/../.." && pwd)"
ENV_FILE="${APP_DIR}/.env.release.local"

if [ -f "${HOME}/.bash_profile" ]; then
  # Load nvm and any shell setup the user already relies on.
  set +u
  # shellcheck disable=SC1090
  source "${HOME}/.bash_profile"
  set -u
fi

if command -v nvm >/dev/null 2>&1; then
  nvm use 20 >/dev/null
fi

if [ ! -f "${ENV_FILE}" ]; then
  echo "Missing ${ENV_FILE}"
  echo "Create it from ${APP_DIR}/.env.release.local.example first."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

required_vars=(
  APPLE_ID
  APPLE_APP_SPECIFIC_PASSWORD
  APPLE_TEAM_ID
)

for var_name in "${required_vars[@]}"; do
  if [ -z "${!var_name:-}" ]; then
    echo "Missing required variable: ${var_name}"
    exit 1
  fi
done

cd "${REPO_ROOT}"
npm --workspace packages/electron-app run dist
