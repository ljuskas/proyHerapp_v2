# Heraap

Laboratorio serverless para desarrollar con React, Lambda, API Gateway REST,
DynamoDB y S3 sobre LocalEmu. Incluye backend de creación y consulta de registros,
infraestructura Docker con persistencia y un frontend funcional de creación y consulta.
`npm run deploy:local` despliega backend y frontend en S3 local.
El workflow de despliegue tras fusionar en `main` está activo y verificado
con el runner dedicado del servidor.

## Versiones fijadas

| Herramienta | Versión |
| --- | --- |
| Node.js de desarrollo | 22.23.5 |
| npm | 10.9.9 |
| React / React DOM | 19.3.1 |
| Vite | 8.3.8 |
| TypeScript | 5.9.3 |
| Playwright | 1.65.1 |
| Serverless Framework | 3.40.0 |
| Adaptador serverless-localstack | 1.3.1 |
| SDK AWS v3 DynamoDB, DocumentClient y Secrets Manager | 3.1177.0 |
| Cliente PostgreSQL (`pg`) | 8.23.1 |
| LocalEmu en Docker | 1.4.0 (digest fijado en Compose) |

Los manifiestos usan versiones exactas y cada paquete incluye su lockfile.
Serverless v3 está sin mantenimiento y se reserva para este laboratorio sin cuenta
de Serverless. `backend/plugins/local-only.cjs` adapta el esquema para Node.js 22
y bloquea destinos, credenciales, regiones y stages distintos de los del laboratorio.

## Acceso con Google

La API exige sesión: sin cookie, `POST /registros` y `GET /registros/{id}` responden
401. El acceso usa OAuth 2.0 con PKCE y el `id_token` se verifica contra el JWKS
de Google. La sesión se guarda en PostgreSQL (solo el hash del token) y viaja en
una cookie `HttpOnly; Secure; SameSite=Lax`.

Para habilitar el flujo real hay que crear un cliente OAuth 2.0 de tipo
«aplicación web» en Google Cloud y autorizar como URI de redirección la del
callback del backend, con el `ApiId` del despliegue:

```
https://local.deptofeliz.uk/_aws/execute-api/<API_ID>/local/auth/google/callback
```

Después, en `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REDIRECT_URI` (esa misma URI), `FRONTEND_URL`
(`https://local.deptofeliz.uk/heraap-frontend-local/index.html`, con `index.html:
LocalEmu responde el listado del bucket si se usa la ruta raíz) y
`npm run secrets:publish`.
Sin esas claves el botón de acceso devuelve 503 y el resto de la app sigue
funcionando. Si el `ApiId` cambiara, hay que actualizar la URI autorizada en
Google Cloud y `GOOGLE_REDIRECT_URI`.

En el laboratorio existe un atajo `POST /auth/dev` con `{"email":"..."}` que crea
una sesión sin Google. Solo está activo con `DEV_LOGIN_ENABLED=1`, que el stack
fija para `stage: local`; no debe existir en un entorno real.

## Base de datos y secretos

La configuración de la aplicación no vive en el despliegue: el contenido de `.env`
se publica en LocalEmu Secrets Manager como `heraap/config` y las Lambdas lo leen
con el SDK. PostgreSQL es el contenedor `postgresql` del servidor, con base y rol
`heraap` dedicados.

```bash
cp .env.example .env          # completar DB_PASSWORD
npm run db:init               # crea rol, base y aplica migraciones (idempotente)
npm run secrets:publish       # crea o actualiza heraap/config desde .env
npm run deploy:backend        # publica el secreto antes de desplegar
```

`npm run db:init` necesita el contenedor `postgresql` en ejecución y acceso a
Docker. Las migraciones están en `backend/db/migrations/` y se aplican una sola
vez, registradas en `schema_migrations`. Ningún valor de `.env` se versiona.

## Requisitos

- Debian o WSL2 con Debian, Bash y Git.
- Python 3 para revisar la sintaxis de las pruebas de infraestructura.
- Node.js y npm en las versiones indicadas; se recomienda nvm.
- Acceso al registro npm para instalar dependencias.
- Docker y LocalEmu no son necesarios para compilar el frontend. Para ejecutar
  el laboratorio se requiere Docker y Compose v2; ver [infra/README.md](infra/README.md).

## Instalación y desarrollo

Desde la raíz del proyecto:

```bash
nvm install
nvm use
node --version
npm --version
npm ci
npm run setup
cp .env.example .env
cp frontend/.env.example frontend/.env.local
npm run dev
```

Vite muestra la URL de desarrollo en la terminal y escucha en `127.0.0.1`
(puerto 5173 por defecto). En el servidor, acceder mediante un túnel SSH:

```bash
ssh -L 5173:127.0.0.1:5173 usuario@servidor
```

Abrir `http://127.0.0.1:5173` en el navegador del equipo cliente.
Antes de crear o consultar, configurar `VITE_API_BASE_URL` en `frontend/.env.local`
con la URL del backend. Ver [frontend/README.md](frontend/README.md).

## Comprobaciones y build

```bash
npm run check
npm run test:backend
npm run test:frontend
npm run test:runner
npm run build
npm --prefix frontend run preview
```

`check` valida versiones, tipos TypeScript, sintaxis de handlers/plugins y sintaxis
Bash y Python. `build` genera `frontend/dist/` con rutas relativas (`base: './'`).
El preview escucha en loopback (puerto 4173 por defecto).
Las pruebas unitarias del backend se ejecutan con `npm run test:backend`; después
de desplegarlo, `npm run test:backend:local` prueba la API real. Las pruebas
de infraestructura están disponibles mediante `npm run infra:verify` e
`npm run infra:verify-persistence`; esta última reinicia el emulador.

`npm run test:frontend:e2e` comprueba escritorio y móvil con respuestas controladas;
`npm run test:frontend:e2e:local` usa el backend real desplegado. Las instrucciones
de instalación del navegador y publicación manual están en frontend/README.md.

## Laboratorio Docker

```bash
npm run infra:up
npm run infra:status
npm run infra:verify
```

Dashboard local: `http://127.0.0.1:4566/_localemu/dashboard`. Para acceder desde la
LAN, configurar `LOCALEMU_LAN_IP` con la IP del servidor en `.env` y ejecutar
`npm run infra:up`; el dashboard y las APIs quedan disponibles también en esa IP.
El ejemplo usa loopback como valor por defecto.
Las Lambdas usan el endpoint
interno `http://localemu:4566`. El emulador conserva los datos en el volumen
`heraap-localemu-data`. Para operar sin Node/npm, usar `bash scripts/localemu.sh`.
Respaldo, migración y retorno se documentan en [infra/README.md](infra/README.md).

## Backend local

```bash
npm run deploy:backend
npm run test:backend:local
```

Se despliega la pila `heraap-local` con tabla `heraap-registros-local`, dos Lambdas,
API Gateway REST y bucket `heraap-frontend-local`. El script imprime la URL de la
API y guarda sus outputs bajo `.state/`. Para crear y consultar registros con
curl, ver [backend/README.md](backend/README.md).

Esta operación todavía es manual. El bucket del frontend queda preparado, pero
su aplicación no se publica con este comando.

## Configuración

`.env.example` contiene únicamente credenciales ficticias (`test`), región
`us-east-1` y el endpoint local `http://127.0.0.1:4566`. Los scripts fijan el entorno
de despliegue a LocalEmu; copiar el archivo no
modifica los perfiles AWS del usuario.

`VITE_API_BASE_URL` se define en `frontend/.env.local` para desarrollo y puede
sobrescribirse en `frontend/.env.production.local` para el build. La API debe ser
accesible desde el navegador del usuario. El despliegue completo usa una ruta relativa al origen
a partir de los outputs de la pila, con prioridad sobre esos archivos.
Los archivos `.env`, dependencias, builds y estado del emulador están excluidos de Git.

## Estructura

```text
frontend/                 React + Vite + TypeScript
  src/main.tsx            Punto de entrada del navegador
  src/App.tsx             Formularios de creación y consulta
  src/api.ts              Cliente HTTP de registros
  src/storage.ts          Recuperación del último ID
  tests/ y e2e/           Pruebas de cliente e interfaz
backend/                  Lambdas, API REST, DynamoDB y serverless.yml
  handlers/               Creación y consulta de registros
  lib/                    DynamoDB, respuestas y logging compartidos
  plugins/                Adaptación Node.js 22 y guardas de entorno local
  tests/                  Pruebas unitarias e integración HTTP
infra/                    Compose de LocalEmu y procedimiento de retorno
scripts/                  Comprobación del entorno y entrada de despliegue
.github/workflows/        Comprobaciones de PR en runners de GitHub
```

## Trabajo por tareas

Cada tarea requiere aprobación previa. Las ramas usan `feat/heraap-NNN`, con
correlativo de tres dígitos; los commits siguen Conventional Commits en español.
Ejemplo: `chore: inicializar estructura del proyecto Heraap`.

`main` es la base de PR. Al trabajar un único desarrollador, la política exige
PR sin aprobaciones externas, el check `Verificar estructura y build`, resolución de conversaciones
y bloqueo de force-push y eliminación de la rama, sin excepciones de administrador.
La protección efectiva se deberá confirmar en GitHub, no solo en esta documentación.
Su configuración declarada está en `.github/main-protection.json`. Tras crear el
repositorio público y publicar la base de `main`, un administrador autenticado
puede aplicarla con:

```bash
gh api --method PUT repos/ljuskas/proyHerapp_v2/branches/main/protection \
  --input .github/main-protection.json
```

No se permiten excepciones de administrador. Los PR son obligatorios y pueden
ser fusionados por su autor cuando las comprobaciones requeridas pasan. El
usuario aprobó eliminar las aprobaciones externas porque trabaja solo.

La base local de `main` se inicializa con un commit vacío para poder presentar el
primer cambio completo mediante PR desde `feat/heraap-001`.
Los commits se publican directamente en las ramas feature. Los PR se abren
únicamente de feature hacia `main`; no se abren PR entre features. Si una tarea
parte de cambios aún pendientes de integración, su futuro PR a `main` incluye esas
dependencias. El despliegue automático se ejecutará después de fusionar el PR,
mediante un push a `main`, nunca al abrir o actualizar el PR.

## Despliegue local completo

Con Node/npm fijados y el laboratorio saludable (`npm run infra:up`), ejecutar:

```bash
npm run deploy:local
```

El comando instala frontend y backend con `npm ci`, despliega la pila local,
espera las Lambdas, obtiene los outputs y compila con una ruta de API relativa
al origen. Sobrescribe `VITE_API_BASE_URL` solo para el proceso de build, sin
modificar los archivos `.env` del desarrollador. Publica assets antes del HTML,
verifica el índice publicado e imprime las URLs finales. No admite argumentos.
Solo un despliegue completo puede ejecutarse a la vez.

La publicación conserva assets anteriores para pestañas abiertas y usa nombres
con hash y caché inmutable; el HTML lleva `Cache-Control: no-cache`. No limpia
el bucket ni la tabla. Repetir el comando conserva los registros existentes.
Si falla, devuelve un código distinto de cero; no revierte automáticamente los
pasos completados. Los archivos temporales de publicación se limpian al salir.

Abrir `http://IP_SERVIDOR:4566/heraap-frontend-local/index.html` o, con el túnel
activo, `https://local.deptofeliz.uk/heraap-frontend-local/index.html`.
Crear un nombre, copiar el ID, recargar y buscarlo. También se puede ejecutar:

```bash
npm run test:backend:local
HERAAP_E2E_FRONTEND_URL=https://local.deptofeliz.uk/heraap-frontend-local/index.html \
  npm run test:frontend:e2e:local
```

Playwright requiere Chromium instalado; ver frontend/README.md. Las pruebas
reales crean y conservan registros de prueba. Para verificar conservación tras
otro despliegue, ejecutar `node backend/tests/integration-local.cjs verify-saved`.

## Despliegue automático desde main

El runner dedicado `heraap-local-main` está instalado como servicio con usuario
propio. `.github/workflows/deploy-local.yml` responde solo a push de `main`,
valida el commit en GitHub y después despliega en el servidor. Un PR solo valida;
su fusión en main dispara la publicación. No ejecutar PR de forks en el servidor.
Instalación, hooks, operación y verificación: [infra/runner.md](infra/runner.md).

La integración inicial se realizó mediante el PR #5. El primer despliegue
automático pasó en el [run 45542049890](https://github.com/ljuskas/proyHerapp_v2/actions/runs/45542049890).
El SHA publicado coincide con main y los registros previos se conservaron.
Ver [status.md](status.md) antes de continuar el trabajo.

Cada publicación incluye `deployment.json` con SHA, fecha UTC, origen manual o
GitHub Actions y, para este último, enlace al run. Se puede consultar en:
`https://local.deptofeliz.uk/heraap-frontend-local/deployment.json`.
El SHA debe coincidir con el commit publicado; el estado final se revisa en Actions.

## Troubleshooting

- `EBADENGINE`: ejecutar `nvm install && nvm use`; comprobar también npm 10.9.9.
- Error de instalación: verificar acceso a `registry.npmjs.org` y usar `npm ci`
  dentro del paquete correspondiente.
- Error de Serverless sobre stage, endpoint o credenciales: usar
  `npm run deploy:backend`, que configura el proceso para el laboratorio.
- LocalEmu inaccesible en 4566: ejecutar `bash scripts/localemu.sh status` y `logs`.
  No arrancar otro laboratorio en el mismo puerto ni el antiguo proceso Python.
