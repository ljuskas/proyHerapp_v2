#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
for arg in "$@"; do
  [[ "$arg" == --force ]] || { echo 'Solo se admite la opción --force.' >&2; exit 1; }
done
node scripts/check-runtime.mjs
bash scripts/localemu.sh status
docker inspect --format '{{.State.Health.Status}}' heraap-localemu | grep -qx healthy
curl --noproxy '*' --fail --silent http://127.0.0.1:4566/_localemu/health \
  | python3 -c 'import sys,json; assert json.load(sys.stdin)["version"] == "1.4.0"'

# Todo queda acotado a este proceso. No cargar perfiles AWS ni heredar proxies.
unset AWS_PROFILE AWS_DEFAULT_PROFILE AWS_SESSION_TOKEN AWS_SECURITY_TOKEN
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1
export AWS_EC2_METADATA_DISABLED=true
export AWS_ENDPOINT_URL=http://127.0.0.1:4566
export SLS_TELEMETRY_DISABLED=1
export SLS_AWS_REQUEST_MAX_RETRIES=1

mkdir -p .state
exec 9>.state/deploy-backend.lock
flock -n 9 || { echo 'Ya hay un despliegue de backend en ejecución.' >&2; exit 1; }
(
  cd backend
  ./node_modules/.bin/serverless deploy --stage local "$@"
)
bash scripts/localemu.sh wait-functions
bash scripts/localemu.sh aws cloudformation describe-stacks --stack-name heraap-local \
  --query 'Stacks[0].Outputs' --output json > .state/backend-outputs.json
python3 - <<'PY'
import json
from pathlib import Path
outputs={entry['OutputKey']: entry['OutputValue'] for entry in json.loads(Path('.state/backend-outputs.json').read_text())}
print('API local:',outputs['ApiUrl'])
print('Tabla:',outputs['TableName'])
print('Bucket frontend:',outputs['FrontendBucketName'])
PY
