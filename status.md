# Heraap v2 — estado, tareas realizadas y pendientes

Actualizado: 2026-11-25 (America/Santiago). Repositorio público:
<https://github.com/ljuskas/proyHerapp_v2>.

Este documento resume qué está hecho (con su commit), qué falta y lo necesario
para retomar el trabajo. El detalle histórico completo vive en `git log`.

## 1. Punto de partida verificado

- `main` = `ed0707a` (*fix: retira el acceso de desarrollo sin Google (#16)*),
  única rama, local y remota.
- Despliegue automático correcto en `ed0707a` (manifiesto público,
  `source github-actions`, `workingTreeDirty false`).
- API protegida: sin cookie, `POST /registros` y `GET /registros/{id}` responden 401.
- Sin endpoint para crear sesiones: se retiraron `POST /auth/dev`, su bandera y
  su handler (tarea 16). Las pruebas usan `backend/tests/soporte/sesion-prueba.cjs`.
- Sin rollback automático ni limpieza de assets históricos.

## 2. Tareas realizadas

| # | Tarea | Commit que la integró en `main` |
| --- | --- | --- |
| 1-3 | Repositorio, estructura, LocalEmu Docker, backend, frontend | `e5f8571` (PR #5) |
| 4 | Corrección Cloudflare: API por el mismo origen | `e5f8571` |
| 5 | Despliegue completo (`deploy:local`) | `e5f8571` |
| 6 | CI/CD local con runner dedicado | `e5f8571` |
| 7 | Integración y primera ejecución automática | `e5f8571` |
| 8 | Cierre documental y entrega | `a77c04d` (PR #6) |
| 9 | Registro del despliegue de cierre | `14b8261` (PR #7) |
| 10 | Documento base del nuevo plan | `cdfb3f9` (PR #8) |
| 11 | PostgreSQL + configuración por secretos | `b4a7eb7` (PR #9) |
| 12 | Login con Google y sesiones protegidas | `969830e` (PR #10) |
| 13 | URI de redirección del callback | `2bc239f` (PR #11) |
| 14 | `FRONTEND_URL` con `index.html` | `24d438f` (PR #13) |
| 15 | Hallazgos de seguridad documentados | `a049ffd` (PR #15) |
| 16 | Retiro del acceso de desarrollo | `ed0707a` (PR #16) |
| 17 | Cierre del túnel y del emulador | PR #17 |

### Base de datos y secretos (tarea 11)

- PostgreSQL 17.4 en el contenedor `postgresql`, base y rol `heraap` dedicados.
- Tablas: `usuarios`, `identidades`, `sesiones`, `auditoria`, `auth_estados` y
  `schema_migrations`; migraciones en `backend/db/migrations/`, transaccionales.
- Secreto `heraap/config` en LocalEmu Secrets Manager (19 claves): toda la
  configuración de `.env`, incluidas `DB_*`, `GOOGLE_*` y `FRONTEND_URL`.
- Las Lambdas solo reciben `SECRET_ID` y `SECRETS_ENDPOINT_URL`; leen el secreto
  con caché de 5 minutos e IAM acotado al ARN.
- Scripts `npm run db:init` y `npm run secrets:publish`, idempotentes.

### Login con Google (tareas 12-14)

- OAuth 2.0 con PKCE: `GET /auth/google/start` y `GET /auth/google/callback`;
  `id_token` verificado contra el JWKS de Google con `jose` 6.2.18 (emisor,
  audiencia y nonce).
- `state` de un solo uso con hash en `auth_estados` (10 minutos).
- Sesión: token de 32 bytes, solo SHA-256 en `sesiones`, 7 días; cookie
  `HttpOnly; Secure; SameSite=Lax; Path=/`.
- `GET /sesion` y `POST /logout`; las rutas de registros guardan `usuarioId`.
- Cliente OAuth creado y claves publicadas en el secreto; falta confirmar el
  login completo con una cuenta real de Google.
- Validaciones añadidas por los errores encontrados:
  - `GOOGLE_REDIRECT_URI` debe terminar en `/auth/google/callback` (es la URI
    autorizada en Google Cloud, no la del frontend).
  - `FRONTEND_URL` debe incluir `index.html`, porque LocalEmu devuelve el
    listado del bucket (XML) en la ruta raíz del sitio.

### Pruebas al cierre de la tarea 12

49 pruebas de backend, 13 del cliente, 22 E2E controlados y 2 E2E reales
(escritorio y móvil), todos en verde; `npm run check` sin errores.

## 3. Pendiente

### Tareas 18-24 — Endurecimiento del laboratorio

Se ejecutan en este orden, cada una en su rama `feat/heraap-NNN`, con aprobación
previa y aprobación aparte del mensaje de commit.

| # | Tarea | Alcance | Aceptación |
| --- | --- | --- | --- |
| 18 | Rotar lo expuesto | Nueva `DB_PASSWORD` y `GOOGLE_CLIENT_SECRET`, republicar el secreto y redesplegar; rotar también el token del túnel | Las claves antiguas no sirven y el login sigue funcionando |
| 19 | Aislar runner y pipeline | `CODEOWNERS` de `.github/`, `scripts/` e `infra/`; revisión obligatoria; runner en VM dedicada | Un PR que toca un workflow no se fusiona sin revisión |
| 20 | PostgreSQL seguro | 5432 solo en red privada, TLS con CA propia y `verify-full`, rol con privilegios mínimos | Sin TLS la conexión se rechaza; API y migraciones funcionan |
| 21 | `state` ligado al navegador | Cookie temporal con el hash del `state`, verificada en el callback, con vencimiento y uso único | `state` válido sin cookie y doble uso rechazados |
| 22 | Autorización y propiedad | `GET /registros/{id}` solo devuelve los del usuario de la sesión; política para registros sin `usuarioId` | Un usuario no lee el registro de otro |
| 23 | Endurecer la API | CORS del frontend, comprobación de `Origin`, cabeceras de seguridad, validación estricta, límite de intentos, tope de sesiones, rotación y purga, logs sin tokens | Pruebas por control; una ráfaga de intentos responde 429 |
| 24 | Cierre | Login real con Google, actualización de este documento, decisión sobre RDS y modo *Testing* | Manifiesto, API y suites en verde |

### Hallazgos verificados el 2026-11-25

- `POST /auth/dev` respondía en el stack público (400 con cuerpo inválido).
- `GET https://local.deptofeliz.uk/_localemu/health` respondía 200: el túnel
  publicaba el puerto 4566 completo, no solo las rutas de la aplicación.
- `ListSecrets` firmado con las credenciales ficticias `test/test` devolvía
  `heraap/config`, con la contraseña de PostgreSQL y el client secret de Google.
  Solo se listó el secreto; no se leyeron los valores. Se dan por comprometidos.
- El túnel es remoto (token en `/etc/systemd/system/cloudflared.service`), así
  que sus reglas se cambian en el panel de Cloudflare, no en el repositorio.
- Las tareas 16 y 18 cubren el retiro del endpoint y la rotación; el resto del
  orden queda en la tabla anterior.

### Otros pendientes

- Confirmar el login real con Google en una ventana privada y documentar el
  resultado.
- Antes de cualquier entorno real: sustituir el contenedor PostgreSQL por RDS
  (hoy LocalEmu no implementa RDS) y crear un stage distinto de `local`, porque
  el plugin solo permite el laboratorio.
- Valorar reiniciar la pantalla de consentimiento de Google cuando deje de
  estar en modo *Testing*.
- Opcional: validación independiente en WSL2 con systemd (no probada).

## 4. Reglas de trabajo

- Cada tarea requiere aprobación explícita del usuario antes de empezar y
  aprobación aparte del mensaje antes de cada commit.
- Commits semánticos en español en `feat/heraap-NNN` creada desde `main`.
- PR solo de feature a `main`, con squash; el merge lo hace el usuario y el
  despliegue ocurre al fusionar, no al abrir el PR.
- `main` protegida: PR obligatorio, check «Verificar estructura y build»,
  0 aprobaciones de terceros, historia lineal, sin force-push.
- Cada módulo nuevo incluye pruebas unitarias propias.
- No se publica ningún endpoint para crear sesiones: `npm run check` falla si
  vuelven `auth/dev` o `DEV_LOGIN_ENABLED`.
- No tocar AWS real, ni ejecutar `npm audit fix --force`, ni cambiar Serverless
  como efecto colateral.

## 5. Entorno operativo

- Servidor Debian, IP LAN `192.168.100.9`; contenedor `heraap-localemu`, red
  `heraap-local`, volumen `heraap-localemu-data` (no usar `down -v`).
- API REST actual `xsmydwgk1h`; el deploy obtiene los outputs. Si el `ApiId`
  cambia, hay que actualizar la URI autorizada en Google Cloud y
  `GOOGLE_REDIRECT_URI`.
- Frontend: `https://local.deptofeliz.uk/heraap-frontend-local/index.html`
  (siempre con `index.html`).
- El puerto 4566 se publica solo en loopback; no hay acceso por LAN.
- El túnel publica `local.deptofeliz.uk` hacia `http://127.0.0.1:4566`, y una
  regla WAF de la zona bloquea `/` y `/_localemu/*`. Las cookies solo funcionan
  por HTTPS.
- Dashboard desactivado (`DASHBOARD_API_OPEN=0`); para abrirlo un momento:
  `DASHBOARD_API_OPEN=1 bash scripts/localemu.sh up` y volver a 0. El endpoint
  `/_localemu/health` sigue disponible para los despliegues.
- PostgreSQL 17.4 en el contenedor `postgresql` (red `n8n_net`), alcanzable
  desde `heraap-local` por `172.18.0.1:5432` o `192.168.100.9:5432`.
- Runner `heraap-local-main` (usuario `heraap-runner`) con hook que solo
  permite publicar `main`.
- Node global del servidor no coincide con el pin: usar el binario fijado.

## 6. Herramientas y comandos

Herramientas en `.state/tools/` (ignorado por git; `/tmp` se vacía):

- Node.js 22.23.5 + npm 10.9.9: `.state/tools/node-v22.23.5-linux-x64/bin`.
- GitHub CLI 2.105.0: `.state/tools/gh_2.105.0_linux_amd64/bin/gh`; token
  temporal en `.state/tools/gh-token`.
- Chromium de Playwright: `.state/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH`).
- Actionlint no está instalado; reinstalar 1.7.12 si se toca `.github/`.

```bash
npm ci && npm run setup && npm run check
npm run test:backend && npm run test:frontend && npm run test:runner
npm run db:init
node backend/tests/soporte/sesion-prueba.cjs     # cookie de sesión de prueba
npm run secrets:publish
npm run deploy:local
npm run test:backend:local
HERAAP_E2E_FRONTEND_URL=https://local.deptofeliz.uk/heraap-frontend-local/index.html \
  npm run test:frontend:e2e:local
```

## 7. Límites y riesgos conocidos

- El contenedor `postgresql` publica 5432 en todas las interfaces; conviene
  restringirlo antes de usar credenciales reales.
- El secreto vive fuera de CloudFormation: si se recrea el volumen, hay que
  volver a publicarlo.
- Serverless v3 arrastra dependencias antiguas con vulnerabilidades conocidas,
  aceptadas para el laboratorio.
- Las pruebas reales crean registros que se conservan; no hay borrado ni
  listado todavía.
- `.state/`, `.env*` y los respaldos están ignorados: nunca publicar credenciales.
- El túnel publicó todo el puerto 4566 hasta el 2026-11-25 y el secreto fue
  legible: `DB_PASSWORD` y `GOOGLE_CLIENT_SECRET` siguen considerándose
  comprometidos hasta completar la tarea 18.
- Se revocaron las sesiones de las cuentas que habían usado el acceso de
  desarrollo (5 sesiones de 3 cuentas, 2026-11-25); el login con Google es otra
  vez el único camino de acceso.
