#!/usr/bin/env bash
# Crea la base y el rol de Heraap en el contenedor PostgreSQL del laboratorio y
# aplica las migraciones. Idempotente: se puede ejecutar varias veces.
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

node scripts/check-runtime.mjs
[[ $# -eq 0 ]] || { echo 'Este comando no admite argumentos.' >&2; exit 1; }

docker inspect postgresql >/dev/null 2>&1 \
  || { echo 'El contenedor postgresql no existe.' >&2; exit 1; }
[[ "$(docker inspect --format '{{.State.Status}}' postgresql)" == running ]] \
  || { echo 'El contenedor postgresql no está en ejecución.' >&2; exit 1; }

ENV_FILE="$PROJECT_DIR/.env"
[[ -f "$ENV_FILE" ]] || { echo 'Falta .env para conocer la base y sus credenciales.' >&2; exit 1; }

# Cargar DB_* desde .env sin ejecutar el archivo como shell.
eval "$(python3 - "$ENV_FILE" <<'PY'
import shlex, sys
from pathlib import Path
allowed = {'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'}
for line in Path(sys.argv[1]).read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, _, value = line.partition('=')
    key = key.strip()
    if key in allowed:
        print(f'export {key}={shlex.quote(value.strip())}')
PY
)"

: "${DB_HOST:?Falta DB_HOST en .env}"
: "${DB_PORT:?Falta DB_PORT en .env}"
: "${DB_NAME:?Falta DB_NAME en .env}"
: "${DB_USER:?Falta DB_USER en .env}"
[[ -n "${DB_PASSWORD:-}" ]] || {
  echo 'Falta DB_PASSWORD en .env (genérala con openssl rand -hex 24).' >&2; exit 1; }

echo "Creando rol y base $DB_NAME en el contenedor postgresql..."
docker exec -i \
  -e DB_NAME="$DB_NAME" -e DB_USER="$DB_USER" -e DB_PASSWORD="$DB_PASSWORD" \
  postgresql psql -v ON_ERROR_STOP=1 -U casaos -d postgres <<'SQL'
\getenv db DB_NAME
\getenv role DB_USER
\getenv pwd DB_PASSWORD
-- No mostrar el SQL generado: contiene la contraseña.
\o /dev/null
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role', :'pwd')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role');
\gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'role', :'pwd');
\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'role')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db');
\gexec
\o
SQL

echo 'Aplicando migraciones...'
(
  cd backend
  export HERAAP_DB_FROM_ENV=1
  export DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
  node db/migrate.cjs
)

echo 'Base preparada. Publica la configuración con: npm run secrets:publish'
