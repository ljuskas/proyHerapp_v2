#!/usr/bin/env bash
set -Eeuo pipefail

# LocalEmu 1.4.0 conserva el bucket interno vacío en el snapshot, pero no su
# directorio temporal. CreateFunction falla después de recrear el contenedor
# si el bucket existe en metadatos y /tmp se perdió. El laboratorio usa us-east-1.
install -d -o localemu -g localemu /tmp/localemu-s3-storage
install -d -o localemu -g localemu \
  /tmp/localemu-s3-storage/awslambda-us-east-1-tasks
