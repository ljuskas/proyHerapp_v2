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
`up` y `restart` esperan también que las dos Lambdas de Heraap estén activas si
ya existen. El healthcheck general del emulador puede estar saludable mientras
las funciones restauradas siguen en `Pending`; esa espera evita 502 transitorios
al consultar la API inmediatamente después de arrancar.

## Versión, datos y red

- Imagen: `localemu/localemu:1.4.0`, fijada por digest en `compose.yml`.
- Contenedor: `heraap-localemu`.
- Volumen persistente: `heraap-localemu-data`, montado en `/var/lib/localemu`.
- Red dedicada: `heraap-local`; alias DNS del servicio: `localemu`.
- API del host: `http://127.0.0.1:4566`.
- API desde las Lambdas: `http://localemu:4566`; `127.0.0.1` dentro de una
  Lambda se refiere a esa Lambda, no al emulador.
- Dashboard: `http://127.0.0.1:4566/_localemu/dashboard`.

El contenedor escucha en todas sus interfaces internas, pero Docker publica el
puerto 4566 **solo en el loopback del servidor**. No hay publicación en la LAN ni
en `0.0.0.0`: el emulador completo, su dashboard y sus APIs AWS quedan fuera de
la red, y el túnel de Cloudflare solo publica `/_aws/execute-api/*` y
`/heraap-frontend-local/*` (el resto lo bloquea el WAF de la zona).

`DASHBOARD_API_OPEN=0` (valor por defecto) desactiva la API del dashboard, que
quedó así fuera de la red y de cualquier contenedor del bridge. El endpoint de
salud `/_localemu/health` sigue disponible porque lo usan los despliegues. Para
abrir el dashboard de forma temporal en el propio servidor:

```bash
DASHBOARD_API_OPEN=1 bash scripts/localemu.sh up   # y volver a 0 al terminar
```

Desde otro equipo, sumar `ssh -L 4566:127.0.0.1:4566 usuario@servidor` y abrir
`http://127.0.0.1:4566/_localemu/dashboard` mientras esté habilitado.

`EXTRA_CORS_ALLOWED_ORIGINS` queda en `http://127.0.0.1:4566`, el único origen
desde el que se abre el dashboard.

El entrypoint oficial ajusta el grupo del socket Docker y ejecuta LocalEmu con el
usuario `localemu`. No se modifica el permiso del socket del host. Docker permite
crear los contenedores de ejecución Lambda en la red dedicada.

Los hooks de `init/boot.d` y `init/ready.d` preparan el almacenamiento temporal de
S3 para LocalEmu 1.4.0. Esa versión puede restaurar un bucket vacío sin reconstruir
su directorio, lo que impide escribir nuevos objetos y cargar código Lambda tras
recrear el contenedor. El hook boot prepara el directorio padre con dueño
`localemu` y el bucket interno de Lambda de `us-east-1`; el hook ready crea los
directorios de los buckets visibles restaurados. No cambian permisos del host
ni las políticas IAM. Se montan como solo lectura en el contenedor.

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

La publicación en LAN se retiró al endurecer el laboratorio: hoy solo existe
la de loopback, y el acceso remoto al dashboard va por un túnel SSH.
