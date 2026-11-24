# Infraestructura local

Este directorio contendrá `compose.yml` para LocalEmu 1.4.0 con puerto 4566 en
loopback, persistencia, socket Docker y red compartida con las Lambdas.

La migración desde la instalación Python del servidor requiere una tarea posterior
aprobada. Se deberá respaldar el estado actual y verificar su recuperación antes
de sustituir el proceso existente. Esta tarea no inicia ni detiene LocalEmu.
