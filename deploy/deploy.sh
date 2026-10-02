#!/usr/bin/env bash
# Actualiza la aplicación en el servidor: ./deploy/deploy.sh [rama]
set -euo pipefail
cd "$(dirname "$0")/.."
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"

[ -f .env.production ] || { echo "Falta .env.production (copia .env.example y rellénalo)"; exit 1; }

echo "→ Copia de seguridad previa"
if [ -f data/tuio-academy.db ]; then docker compose run --rm --no-deps --entrypoint sh cron -c "apk add --no-cache sqlite >/dev/null && /usr/local/bin/backup.sh"; fi

echo "→ Descargando cambios de $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "→ Construyendo y reiniciando"
docker compose up -d --build
docker image prune -f >/dev/null

echo "→ Comprobando que responde"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then echo "✓ Tuio Academy en marcha"; exit 0; fi
  sleep 2
done
echo "✗ La aplicación no responde. Revisa: docker compose logs app"; exit 1
