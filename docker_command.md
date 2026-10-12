# Taskyard Docker (Show Engine–style)

Same machine pattern as `show_engine_website`: Docker image + `cloudflare-net` + Cloudflare Tunnel public hostname.

Differences from Show Engine (on purpose):

- Host port **3003** (Show Engine already owns **3000**)
- Image is **Debian slim**, not Alpine (`better-sqlite3`)
- Persist SQLite with a **data volume** (do not bind-mount the whole repo over `/app` — that would replace the image build)
- This container is the **web UI only**; hub (`3001`/`3002`) and workers stay on the host for now

## Update / deploy

```bash
cd ~/Taskyard
./docker-update.sh
```

Pulls latest git, rebuilds the image, recreates the container with `./data` mounted and `--network cloudflare-net`. The live DB is kept.

## First-time network (once)

```bash
# Only if it does not already exist:
sudo docker network create cloudflare-net
# cloudflared should already be on this network
```

In Cloudflare Zero Trust → your existing tunnel → Public Hostname:

| Public hostname | Service |
|---|---|
| `taskyard.app` | `http://taskyard:3000` |

## Manual run (same as the script)

```bash
sudo docker run -d \
  --name taskyard \
  --network cloudflare-net \
  -p 3003:3000 \
  -v "$(pwd)/data":/app/data \
  --restart unless-stopped \
  taskyard
```

## Useful commands

```bash
sudo docker logs -f taskyard
sudo docker restart taskyard
```

## Host-side live reload (sandbox DB)

`pnpm dev:server` (`next dev`) automatically uses `data/taskyard-dev.db` — not the live Docker file — and draws a bright red frame on the page. No `TASKYARD_DB_PATH` needed. Explicit `TASKYARD_DB_PATH` still wins if set.

Keep the Docker container on `taskyard.app` for invitees. Point `dev.taskyard.app` at `http://172.18.0.1:3004` (`pnpm dev:server` binds that port).

`pnpm dev:server` refreshes `data/taskyard-dev.db` from the live `data/taskyard.db` on each start (SQLite online backup). Sandbox edits are discarded the next time you start:dev.

Manual refresh without starting the server:

```bash
pnpm db:sync-sandbox
```