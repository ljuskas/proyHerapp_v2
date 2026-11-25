#!/usr/bin/env bash
# Publica el contenido de .env como secreto en LocalEmu Secrets Manager.
# Uso: bash scripts/publish-secrets-local.sh [--check]
#   --check  solo verifica que el secreto exista (modo despliegue sin .env).
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

mode=publish
for arg in "$@"; do
  case "$arg" in
    --check) mode=check ;;
    *) echo 'Solo se admite --check.' >&2; exit 1 ;;
  esac
done

export HERAAP_PROJECT_DIR="$PROJECT_DIR"
export HERAAP_SECRETS_MODE="$mode"

python3 - <<'PY'
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path

project = Path(os.environ['HERAAP_PROJECT_DIR'])
mode = os.environ['HERAAP_SECRETS_MODE']
env_file = project / '.env'
secret_name = os.environ.get('SECRET_ID', 'heraap/config')

def aws(*args, check=True):
    cmd = ['bash', str(project / 'scripts' / 'localemu.sh'), 'aws', *args]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if check and result.returncode != 0:
        sys.exit(f"Error de AWS CLI local: {result.stderr.strip()}")
    return result

def secret_exists():
    result = aws('secretsmanager', 'describe-secret', '--secret-id', secret_name, check=False)
    return result.returncode == 0

if mode == 'check':
    if not secret_exists():
        sys.exit(f"El secreto {secret_name} no existe en LocalEmu; publícalo con .env.")
    print(f"Secreto verificado: {secret_name}")
    raise SystemExit(0)

if not env_file.exists():
    sys.exit('Falta .env con la configuración que se publicará como secreto.')

data = {}
for line in env_file.read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, _, value = line.partition('=')
    key = key.strip()
    if not key or key.startswith('export '):
        key = key.removeprefix('export ').strip()
    value = value.strip().strip('"').strip("'")
    data[key] = value

if not data:
    sys.exit('.env no contiene variables para publicar.')

payload = json.dumps(data, ensure_ascii=False, sort_keys=True)
token = str(uuid.uuid4())
if secret_exists():
    result = aws('secretsmanager', 'put-secret-value',
                 '--secret-id', secret_name,
                 '--secret-string', payload,
                 '--client-request-token', token)
    action = 'actualizado'
else:
    result = aws('secretsmanager', 'create-secret',
                 '--name', secret_name,
                 '--secret-string', payload,
                 '--client-request-token', token)
    action = 'creado'
print(f"Secreto {secret_name} {action} con {len(data)} clave(s).")
PY
