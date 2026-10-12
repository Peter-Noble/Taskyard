#!/usr/bin/env bash
# Pull latest, rebuild the Taskyard web image, and recreate the container.
# SQLite under ./data is bind-mounted and kept across updates.
set -euo pipefail

cd "$(dirname "$0")"

IMAGE="${TASKYARD_IMAGE:-taskyard}"
NAME="${TASKYARD_CONTAINER:-taskyard}"
HOST_PORT="${TASKYARD_HOST_PORT:-3003}"
NETWORK="${TASKYARD_NETWORK:-cloudflare-net}"

echo "==> git pull"
git pull

echo "==> docker build -t ${IMAGE}"
sudo docker build -t "${IMAGE}" .

if sudo docker inspect "${NAME}" >/dev/null 2>&1; then
  echo "==> stop/remove ${NAME}"
  sudo docker stop "${NAME}"
  sudo docker rm "${NAME}"
fi

echo "==> run ${NAME} on :${HOST_PORT} (${NETWORK})"
sudo docker run -d \
  --name "${NAME}" \
  --network "${NETWORK}" \
  -p "${HOST_PORT}:3000" \
  -v "$(pwd)/data":/app/data \
  --restart unless-stopped \
  "${IMAGE}"

echo "==> done"
sudo docker ps --filter "name=^/${NAME}$"
