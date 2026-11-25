#!/usr/bin/env bash
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo 'Ejecutar como root para instalar usuario y servicio.' >&2; exit 1; }
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER_DIR=/opt/heraap-runner
RUNNER_VERSION=2.338.2
RUNNER_SHA256=baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40
[[ ! -f "$RUNNER_DIR/.runner" ]] || { echo 'El runner ya está registrado; usar svc.sh para operarlo.' >&2; exit 1; }
getent group docker >/dev/null
id heraap-runner >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/heraap-runner --shell /bin/bash heraap-runner
usermod -aG docker heraap-runner
install -d -m 700 -o heraap-runner -g heraap-runner "$RUNNER_DIR" /var/lib/heraap-runner
install -d -m 755 /etc/heraap-runner
install -m 755 "$PROJECT_DIR/scripts/runner-job-started.sh" /etc/heraap-runner/job-started.sh

archive="$(mktemp /tmp/heraap-runner.XXXXXXXX.tar.gz)"
trap 'rm -f "$archive"; unset registration_token' EXIT
curl --fail --location --silent --show-error \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" -o "$archive"
echo "$RUNNER_SHA256  $archive" | sha256sum --check --status
tar -xzf "$archive" -C "$RUNNER_DIR"
chown -R heraap-runner:heraap-runner "$RUNNER_DIR"
echo 'Esperando token de registro por stdin (no se guarda en el repositorio).' >&2
IFS= read -r registration_token
[[ -n "$registration_token" ]] || exit 1
cd "$RUNNER_DIR"
runuser -u heraap-runner -- ./config.sh --unattended \
  --url https://github.com/ljuskas/proyHerapp_v2 --token "$registration_token" \
  --name heraap-local-main --labels heraap-local-main --work _work
unset registration_token
# No heredar rutas privadas de la sesión del administrador.
printf '%s\n' 'ACTIONS_RUNNER_HOOK_JOB_STARTED=/etc/heraap-runner/job-started.sh' \
  'RUNNER_TOOL_CACHE=/var/lib/heraap-runner/tools' 'LANG=C.UTF-8' > .env
chown heraap-runner:heraap-runner .env
chmod 600 .env
printf '%s\n' '/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin' > .path
chown heraap-runner:heraap-runner .path
./svc.sh install heraap-runner
./svc.sh start
./svc.sh status
