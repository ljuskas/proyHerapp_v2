#!/usr/bin/env bash
set -Eeuo pipefail

# Instalar fuera del checkout, propiedad de root. No cargar código del PR.
python3 - <<'PY'
import json, os, sys
expected = {
    'GITHUB_REPOSITORY': 'ljuskas/proyHerapp_v2',
    'GITHUB_EVENT_NAME': 'push',
    'GITHUB_REF': 'refs/heads/main',
    'GITHUB_WORKFLOW_REF': 'ljuskas/proyHerapp_v2/.github/workflows/deploy-local.yml@refs/heads/main',
}
if any(os.environ.get(key) != value for key, value in expected.items()):
    sys.exit('Runner reservado al workflow de despliegue por push a main. Trabajo rechazado.')
with open(os.environ['GITHUB_EVENT_PATH']) as stream:
    event = json.load(stream)
if (event.get('ref') != 'refs/heads/main'
        or event.get('repository', {}).get('full_name') != 'ljuskas/proyHerapp_v2'
        or event.get('after') != os.environ.get('GITHUB_SHA')
        or event.get('deleted')):
    sys.exit('El evento no corresponde a un push válido de main. Trabajo rechazado.')
print('Evento autorizado: despliegue de main en LocalEmu.')
PY
