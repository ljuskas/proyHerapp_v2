#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
[[ $# -eq 0 ]] || { echo 'Este comando no admite argumentos.' >&2; exit 1; }
node scripts/check-runtime.mjs
mkdir -p .state
exec 8>.state/deploy-local.lock
flock -n 8 || { echo 'Ya hay un despliegue completo en ejecución.' >&2; exit 1; }

staging=''
cleanup() {
  if [[ -n "$staging" ]]; then
    docker exec heraap-localemu rm -rf "$staging" || true
  fi
}
trap cleanup EXIT

# Comprobar el laboratorio antes de instalar o desplegar.
bash scripts/localemu.sh status
docker inspect --format '{{.State.Health.Status}}' heraap-localemu | grep -qx healthy
npm --prefix frontend ci
npm --prefix backend ci
bash scripts/deploy-backend-local.sh

# Compartir el origen del HTML permite acceder por LAN y por el túnel HTTPS.
# La variable del proceso tiene prioridad sobre los archivos .env de Vite.
api_path="$(python3 - <<'PY'
import json
from pathlib import Path
from urllib.parse import urlsplit
outputs = {x['OutputKey']: x['OutputValue'] for x in json.loads(Path('.state/backend-outputs.json').read_text())}
url = urlsplit(outputs['ApiUrl'])
assert url.scheme == 'http' and url.hostname == '127.0.0.1' and url.port == 4566
assert outputs['FrontendBucketName'] == 'heraap-frontend-local'
assert url.path.startswith('/_aws/execute-api/') and url.path.endswith('/local')
print(url.path)
PY
)"
VITE_API_BASE_URL="$api_path" npm run build

staging="$(docker exec heraap-localemu mktemp -d /tmp/heraap-publish.XXXXXXXX)"
docker cp frontend/dist/. "heraap-localemu:$staging"
# Publicar assets antes del HTML y evitar que el navegador conserve un índice viejo.
bash scripts/localemu.sh aws s3 cp "$staging/assets/" s3://heraap-frontend-local/assets/ --recursive \
  --cache-control 'public,max-age=31536000,immutable'
bash scripts/localemu.sh aws s3 cp "$staging/index.html" s3://heraap-frontend-local/index.html \
  --content-type 'text/html; charset=utf-8' --cache-control 'no-cache'
curl --noproxy '*' --fail --silent http://127.0.0.1:4566/heraap-frontend-local/index.html > .state/frontend-published.html
cmp frontend/dist/index.html .state/frontend-published.html

echo 'Despliegue completo en LocalEmu.'
echo 'Frontend local: http://127.0.0.1:4566/heraap-frontend-local/index.html'
echo 'Frontend público (requiere túnel activo): https://local.deptofeliz.uk/heraap-frontend-local/index.html'
echo "Ruta API (mismo origen del frontend): $api_path"
echo 'Outputs del backend: .state/backend-outputs.json'
