#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="$PROJECT_DIR/.env.example"
fi
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$PROJECT_DIR/infra/compose.yml")
PYTHON=/opt/code/localemu/.venv/bin/python
PROBE=/var/lib/localemu/.heraap-infra-probe.json

probe() {
  "${COMPOSE[@]}" exec -T localemu "$PYTHON" - "$1" --state "$PROBE" \
    < "$PROJECT_DIR/scripts/verify-localemu.py"
}

wait_functions() {
  "${COMPOSE[@]}" exec -T localemu "$PYTHON" - <<'PY'
import boto3
client = boto3.client('lambda', endpoint_url='http://127.0.0.1:4566',
                      region_name='us-east-1', aws_access_key_id='test', aws_secret_access_key='test')
for name in ['heraap-local-createRegistro', 'heraap-local-getRegistro']:
    try:
        client.get_function_configuration(FunctionName=name)
    except client.exceptions.ResourceNotFoundException:
        continue
    print('Esperando Lambda activa:', name, flush=True)
    client.get_waiter('function_active_v2').wait(
        FunctionName=name, WaiterConfig={'Delay': 2, 'MaxAttempts': 120})
PY
}

case "${1:-help}" in
  up)
    "${COMPOSE[@]}" up -d --wait --wait-timeout 180
    wait_functions
    ;;
  stop) "${COMPOSE[@]}" stop localemu ;;
  restart)
    "${COMPOSE[@]}" restart localemu
    "${COMPOSE[@]}" up -d --wait --wait-timeout 180
    wait_functions
    ;;
  wait-functions) wait_functions ;;
  status) "${COMPOSE[@]}" ps ;;
  logs) "${COMPOSE[@]}" logs --tail 100 localemu ;;
  config) "${COMPOSE[@]}" config --quiet ;;
  verify) probe all ;;
  verify-persistence)
    probe seed
    # Si falla el reinicio o la lectura, conservar los datos de prueba para diagnóstico.
    bash "$PROJECT_DIR/scripts/localemu.sh" restart
    probe read
    probe cleanup
    ;;
  probe-seed) probe seed ;;
  probe-read) probe read ;;
  probe-cleanup) probe cleanup ;;
  aws)
    shift
    for arg in "$@"; do
      if [[ "$arg" == --endpoint-url* ]]; then
        echo 'Este comando usa únicamente el endpoint local configurado.' >&2
        exit 1
      fi
    done
    "${COMPOSE[@]}" exec -T \
      -e AWS_ACCESS_KEY_ID=test -e AWS_SECRET_ACCESS_KEY=test -e AWS_SESSION_TOKEN= \
      -e AWS_ENDPOINT_URL=http://127.0.0.1:4566 \
      localemu /opt/code/localemu/.venv/bin/aws \
      --endpoint-url http://127.0.0.1:4566 "$@"
    ;;
  *)
    echo 'Uso: bash scripts/localemu.sh {up|stop|restart|status|logs|config|verify|verify-persistence|wait-functions|aws <argumentos>}'
    ;;
esac
