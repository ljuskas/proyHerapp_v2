# LocalEmu en Docker

Servicio del laboratorio Heraap. El Compose inicia únicamente LocalEmu; el backend
y el despliegue de la aplicación siguen pendientes de sus tareas aprobadas.

## Requisitos y arranque

Docker Engine y Compose v2 con soporte de `up --wait`, socket en
`/var/run/docker.sock` y puerto 4566 disponible. Verificado en Debian x86_64 con
Docker 28.2.2 y Compose 2.36.2. En WSL2, habilitar la integración Docker con Debian.
La primera descarga de las imágenes de LocalEmu y Lambda necesita Internet.

Desde la raíz del repositorio:

```bash
bash scripts/localemu.sh config
bash scripts/localemu.sh up
bash scripts/localemu.sh status
bash scripts/localemu.sh logs
bash scripts/localemu.sh aws s3 ls
```

También están disponibles `npm run infra:up` e `npm run infra:status`.
No se necesita instalar boto3 ni AWS CLI en el host: los comandos AWS y las
pruebas usan las herramientas incluidas en la imagen.

## Versión, datos y red

- Imagen: `localemu/localemu:1.4.0`, fijada por digest en `compose.yml`.
- Contenedor: `heraap-localemu`.
- Volumen persistente: `heraap-localemu-data`, montado en `/var/lib/localemu`.
- Red dedicada: `heraap-local`; alias DNS del servicio: `localemu`.
- API del host: `http://127.0.0.1:4566`.
- API desde las Lambdas: `http://localemu:4566`; `127.0.0.1` dentro de una
  Lambda se refiere a esa Lambda, no al emulador.
- Dashboard: `http://127.0.0.1:4566/_localemu/dashboard`.

El contenedor escucha en todas sus interfaces internas. Por defecto, Docker
publica el puerto solamente en el loopback del servidor. Para habilitar acceso
desde la LAN, configurar la IP del servidor en el `.env` de la raíz:

```dotenv
LOCALEMU_LAN_IP=192.168.100.9
```

Después ejecutar `bash scripts/localemu.sh up`. El script lee explícitamente ese
archivo, independientemente del directorio de trabajo. Si no existe, usa
`.env.example`, que mantiene el acceso solo por loopback. Compose deduplica las
dos publicaciones cuando ambas apuntan a `127.0.0.1`.

Con esa configuración, el dashboard está en
`http://192.168.100.9:4566/_localemu/dashboard`, además de loopback. También quedan
accesibles las APIs AWS del emulador en esa IP. `EXTRA_CORS_ALLOWED_ORIGINS` se
configura con ese mismo origen para que carguen los recursos y las peticiones
del dashboard. La IP propia de cada servidor queda en `.env`, excluido de Git.

Como alternativa al acceso LAN, usar un túnel SSH:

```bash
ssh -L 4566:127.0.0.1:4566 usuario@servidor
```

Abrir el dashboard en el navegador del cliente usando esa misma URL local.
`DASHBOARD_API_OPEN=1` permite las peticiones que llegan al contenedor por el
bridge Docker. La publicación LAN se limita a la IP configurada, sin usar
`0.0.0.0` como dirección de publicación del host.

El entrypoint oficial ajusta el grupo del socket Docker y ejecuta LocalEmu con el
usuario `localemu`. No se modifica el permiso del socket del host. Docker permite
crear los contenedores de ejecución Lambda en la red dedicada.

Persistencia habilitada con snapshots cada 15 segundos, restauración al arrancar
y guardado final al detener. El periodo de gracia de parada es de 60 segundos.
`restart: unless-stopped` recupera el servicio cuando vuelve el daemon Docker,
salvo si se había detenido explícitamente. Límites del emulador: 2 CPU y 4 GiB;
los contenedores Lambda son procesos separados. Logs Docker rotados: 3 archivos
de hasta 10 MiB.

## Verificaciones

```bash
# Crea y lee datos en S3/DynamoDB, ejecuta una Lambda Node.js 22 y limpia la prueba.
bash scripts/localemu.sh verify

# Reinicia el servicio y verifica que los datos sobrevivan.
bash scripts/localemu.sh verify-persistence
```

`verify` genera nombres únicos `heraap-infra-check-*`. La Lambda consulta el
healthcheck mediante `http://localemu:4566` y comprueba su runtime Node.js 22.
Los recursos temporales se eliminan al finalizar. El estado de la prueba está en
`/var/lib/localemu/.heraap-infra-probe.json` mientras se necesita.

Si `verify-persistence` falla, conserva los datos para diagnóstico. Después de
resolver el problema, ejecutar `probe-read` y `probe-cleanup` mediante el mismo
script. No iniciar otra prueba mientras exista una pendiente. La prueba usa boto3
incluido en la imagen y fija el endpoint de todas sus llamadas a loopback.

## Parada y recuperación

```bash
bash scripts/localemu.sh stop
bash scripts/localemu.sh up
```

El volumen conserva los datos al parar o recrear el contenedor. No usar
`docker compose down --volumes` ni eliminar `heraap-localemu-data` si se quieren
conservar los registros.

Para respaldar el volumen actual de forma consistente, detener el servicio,
archivar el volumen montado en solo lectura mediante un contenedor auxiliar y
volver a arrancar. Los snapshots son datos internos de LocalEmu: conservar la
versión de la imagen junto al respaldo.

## Migración realizada desde Python

La instalación anterior estaba en `../localemu-lab` respecto al repositorio.
El procedimiento ejecutado fue:

1. Inventariar buckets y tablas existentes y crear datos temporales verificables.
2. Solicitar `POST /_localemu/state/save` y comprobar que no reportara errores.
3. Validar PID, ejecutable y `FILESYSTEM_ROOT` del proceso anterior; detenerlo con
   SIGTERM, sin forzar SIGKILL.
4. Copiar su directorio `.state` completo a un respaldo privado bajo
   `.state/migrations/`, fuera de Git, y calcular SHA-256 de sus archivos.
5. Crear volumen, red y contenedor nuevos mediante este Compose.
6. Copiar el contenido anterior de `.state/runtime/var/lib/localemu/` al nuevo
   volumen y asignar sus permisos al usuario `localemu` de la imagen.
7. Iniciar con healthcheck, leer S3/DynamoDB, reiniciar y volver a leer; limpiar
   los recursos temporales después de comprobar la recuperación.

El registro local de la migración está en `.state/last-migration.json`; contiene
la ruta del respaldo y el digest usado. El respaldo contiene `legacy-state/`,
`sha256.json` y la respuesta del guardado manual. El origen detenido se conserva
en su ubicación original. No arrancar simultáneamente el antiguo `lab.sh start`
y este Compose, porque comparten el puerto 4566. Usar los comandos de este
repositorio para operar el servicio migrado.

## Procedimiento de retorno al estado anterior

El retorno usa el estado congelado en el momento de la migración, no incorpora
escrituras posteriores del contenedor. Antes de un retorno posterior con datos
nuevos, respaldar también el volumen Docker actual.

En el servidor que conserva `../localemu-lab`:

1. Verificar que el estado anterior coincide con `sha256.json`. Si cambió,
   recuperar `legacy-state/` del respaldo en un directorio aparte y revisar antes
   de sustituir datos.
2. Ejecutar `bash scripts/localemu.sh stop` y confirmar que liberó el puerto 4566.
3. Ejecutar `bash ../localemu-lab/lab.sh start` y comprobar el healthcheck.
4. Si existe el marcador de prueba anterior, comprobarlo y limpiarlo:

   ```bash
   ../localemu-lab/.venv/bin/python scripts/verify-localemu.py read \
     --state ../localemu-lab/.state/runtime/var/lib/localemu/.heraap-infra-probe.json
   ../localemu-lab/.venv/bin/python scripts/verify-localemu.py cleanup \
     --state ../localemu-lab/.state/runtime/var/lib/localemu/.heraap-infra-probe.json
   ```

5. Mantener el contenedor detenido mientras opere la instalación Python. Para
   volver a Docker, detener primero el PID validado del runtime Python; no usar
   una búsqueda global de procesos que pueda detener otros servicios.

No se elimina el volumen Docker ni el respaldo durante un retorno.

## Validación de la migración

Comprobado el 2026-11-24:

- Respaldo de 41 archivos, con SHA-256 coincidentes con el origen detenido.
- Recuperación de contenido S3 y registro DynamoDB tras migrar de Python a Docker.
- Recuperación de ambos datos tras reiniciar el contenedor, incluida la prueba
  reproducible `verify-persistence`.
- Ejecución real de Lambda Node.js `v22.23.5` y acceso a LocalEmu 1.4.0 por DNS Docker.
- Dashboard HTTP 200 y puerto inicialmente publicado en `127.0.0.1:4566`.
- Limpieza de bucket, tabla, función, rol y grupo de logs temporales.

El retorno al proceso Python está documentado; no se ejecutó un ensayo completo
de retorno después de la migración. La instalación anterior y el respaldo se
conservaron. No se ha probado un reinicio completo del servidor.

La corrección posterior de acceso LAN añade una segunda publicación mediante
`LOCALEMU_LAN_IP`, manteniendo el volumen y la publicación de loopback.
