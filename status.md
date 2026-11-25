# Heraap v2 — estado verificado y base del próximo plan

Actualizado: 2026-11-25 (America/Santiago). Repositorio público:
<https://github.com/ljuskas/proyHerapp_v2>.

Este documento sustituye al informe histórico. Conserva solo lo necesario para
retomar el trabajo y redactar el prompt de las tareas pendientes. El detalle
anterior sigue disponible en el historial de git.

## 1. Punto de partida verificado

- `main` = `14b8261cb472f460ddf74c67d22118173b4c7c01`. Es la única rama, local y
  remota. No hay PR abiertos; el PR #1 (scaffold) quedó cerrado sin fusionar y
  las ramas `feat/heraap-001…009` se eliminaron tras respaldarlas en
  `.state/backup-ramas-feature-20261125.bundle` (local, ignorado por git).
- Último despliegue automático: run
  [45545102139](https://github.com/ljuskas/proyHerapp_v2/actions/runs/45545102139),
  success. `deployment.json` público en `14b8261`, `source github-actions`,
  `workingTreeDirty false`.
- Comprobado tras ese despliegue: frontend
  <https://local.deptofeliz.uk/heraap-frontend-local/index.html> responde 200 y
  el registro `58de73bf-8740-4afa-9d1d-39870a524d70` responde 200 vía API.
- Funcionalidad actual: crear registro (`POST /registros`) y consultarlo por ID
  (`GET /registros/{id}`). No hay autenticación, listado, edición ni borrado.
- Stack: LocalEmu 1.4.0 en Docker (imagen fijada por digest), API Gateway REST,
  dos Lambdas Node.js 22, DynamoDB (`heraap-registros-local`, PK string) y S3
  para el frontend React/Vite/TypeScript.
- PostgreSQL 17.4 operativo con base y rol `heraap`: tablas `usuarios`,
  `identidades`, `sesiones`, `auditoria` y `schema_migrations`. El secreto
  `heraap/config` en LocalEmu agrupa toda la configuración de `.env`.
- Acceso con Google implementado (PKCE, verificación de `id_token`, sesión en
  PostgreSQL con cookie `HttpOnly; Secure`). Sin credenciales de Google aún:
  hace falta crear el cliente OAuth y publicar `GOOGLE_*` en el secreto.
- Entorno local verificado con el pin del repo: `npm ci`, `npm run setup`,
  `npm run check`, tests de backend 9/9, de frontend 9/9 y del hook del runner
  3/3, con Node.js 22.23.5 y npm 10.9.9.

## 2. Reglas de trabajo (vigentes)

- Toda tarea nueva requiere aprobación explícita del usuario antes de empezar,
  y aprobación aparte del mensaje antes de cada commit.
- Commits semánticos en español, siempre dentro de `feat/heraap-NNN` creada
  desde `main` actualizado.
- PR únicamente de feature a `main`; nunca encadenados entre features ni push
  directo a `main`. El merge lo realiza el usuario; el despliegue automático
  ocurre al fusionar en `main`, no al abrir o actualizar el PR.
- `main` está protegida: PR obligatorio, check «Verificar estructura y build»,
  0 aprobaciones de terceros, historia lineal (squash), sin force-push.
- Cada módulo nuevo debe incluir pruebas unitarias propias, además de los
  controles existentes (`npm run check`, tests, actionlint si se toca `.github/`).
- Ningún valor de `.env` se commitea ni se inyecta como variable plana en el
  despliegue: se publica como entrada del secreto en LocalEmu Secrets Manager y
  las Lambdas lo leen con el SDK. `.env` queda solo como fuente local de carga.
- No tocar AWS real. No ejecutar `npm audit fix --force` ni cambiar Serverless
  como efecto colateral de otra tarea.
- Sin autorización no se fusiona, no se cierran PRs ni se alteran protecciones.

## 3. Backlog aprobado pendiente

### Tarea 0 — Base de datos relacional y secretos (completada en `feat/heraap-011`)

Objetivo: almacenar usuarios, identidades y sesiones en PostgreSQL, con las
credenciales y la configuración sensible en Secrets Manager, preparado para un
RDS PostgreSQL cuando exista infraestructura real.

Decisión tomada (2026-11-25): se usa el contenedor `postgresql` existente
(PostgreSQL 17.4, datos en `/DATA/AppData/postgresql/data`), que ya aloja una
base por aplicación (`coaching`, `fecu`, `finanzas`, `fecubv`). Se creará la base
`heraap` y el rol `heraap`, aislados de las demás. Las Lambdas lo alcanzan desde
la red `heraap-local` por `172.18.0.1:5432` o por la IP LAN
`192.168.100.9:5432`; el nombre `postgresql` no resuelve desde esa red.

Alcance mínimo:

- Base `heraap` y rol `heraap` con permisos solo sobre su base y su esquema;
  contraseña generada para el laboratorio y guardada únicamente en el secreto.
- Esquema versionado (`schema.sql` + migraciones idempotentes) con tablas de
  usuarios, identidades externas (Google), sesiones y auditoría básica.
- Secreto `heraap/config` en LocalEmu Secrets Manager con JSON de configuración
  (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` y, en su momento,
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`). Lo crea o actualiza el script de
  despliegue desde `.env`, con `ClientRequestToken` UUID porque LocalEmu lo exige
  en `CreateSecret`/`PutSecretValue`.
- Lectura del secreto desde las Lambdas con `@aws-sdk/client-secrets-manager`,
  caché en memoria por ejecución y política IAM limitada al ARN del secreto.
- Script de arranque/verificación de la base integrado en los scripts locales.
- Pruebas unitarias del acceso a datos (conexión simulada) y de la carga del
  secreto, incluyendo el caso de secreto ausente o JSON inválido.

Descartado: `AWS::RDS::DBInstance` no se despliega en LocalEmu 1.4.0 porque RDS no
está implementado (`DescribeDBEngineVersions` responde `InternalFailure`); queda
solo como objetivo de producción.

### Tarea 1 — Login con Google (completada en `feat/heraap-012`)

Objetivo: autenticación de usuario con Google y alta de sesión propia.

Alcance mínimo:

- Flujo OAuth 2.0/OIDC con Google: botón de acceso, callback, verificación del
  `id_token` contra el JWKS de Google (emisor, audiencia, expiración, nonce).
- Alta o vinculación del usuario en PostgreSQL a partir del `sub` de Google.
- Sesión propia (cookie `HttpOnly`, `Secure`, `SameSite`) emitida por el backend,
  con expiración y cierre de sesión.
- Endpoint de identidad (`GET /sesion`) y protección de las rutas existentes.
- Frontend: estados de carga/error, usuario identificado y cierre de sesión.
- Pruebas unitarias del callback, validación del token y creación de sesión.

Decisiones requeridas: client ID/secret de Google (guardados en el secreto
`heraap/config` de Secrets Manager, nunca en el repo), URI de redirección con el
túnel HTTPS, alcance (`openid email profile`) y política de sesión (duración,
renovación, revocación).

### Tarea 2 — Acceso seguro y endurecimiento

Objetivo: reducir superficie de ataque e inyección en todo el módulo.

Alcance mínimo:

- Consultas parametrizadas y validación estricta de entrada en cada endpoint.
- Hash de contraseñas con Argon2id si se admite login local; o solo Google si se
  decide no almacenar contraseñas.
- Límite de intentos y bloqueo temporal; rate limiting por IP e identidad.
- CSRF para operaciones con cookie, CORS con credenciales restringido al origen
  del frontend, cabeceras de seguridad y errores genéricos.
- Logs sin datos sensibles ni tokens; auditoría de accesos y fallos.
- Pruebas unitarias de validación, rate limiting y CSRF.

## 4. Entorno operativo (resumen para reconstruir el prompt)

- Servidor Debian, IP LAN `192.168.100.9`; contenedor `heraap-localemu`, red
  `heraap-local`, volumen persistente `heraap-localemu-data` (no usar down -v).
- API REST actual `xsmydwgk1h`; el deploy obtiene los outputs, no fijar el ID.
- Frontend público: `https://local.deptofeliz.uk/heraap-frontend-local/index.html`.
  Frontend LAN: `http://192.168.100.9:4566/heraap-frontend-local/index.html`.
  Dashboard: `http://192.168.100.9:4566/_localemu/dashboard`.
- El túnel Cloudflare publica el puerto 4566 completo; el navegador usa HTTPS y
  el frontend llama a la API por ruta relativa del mismo origen. Cualquier cookie
  de sesión y cualquier callback OAuth deben respetar ese origen.
- Runner `heraap-local-main` (usuario `heraap-runner`) con hook que rechaza PR,
  forks, features y otros workflows; solo publica `main`.
- Node global del servidor no coincide con el pin: usar el binario fijado.
- PostgreSQL 17.4 en el contenedor `postgresql` (red `n8n_net`, publica 5432 en
  todas las interfaces). Base `heraap` y rol `heraap` propios. Alcanzable desde
  `heraap-local` por `172.18.0.1:5432` o `192.168.100.9:5432`.
- Secrets Manager de LocalEmu operativo: `CreateSecret`, `GetSecretValue`,
  `PutSecretValue` y `DeleteSecret` verificados; `ListSecrets` responde vacío
  cuando no hay secretos. Exige `ClientRequestToken` UUID en create y put.

## 5. Herramientas y comandos

Herramientas en `.state/tools/` (ignorado por git; `/tmp` se vacía entre sesiones):

- Node.js 22.23.5 + npm 10.9.9: `.state/tools/node-v22.23.5-linux-x64/bin`.
- GitHub CLI 2.105.0: `.state/tools/gh_2.105.0_linux_amd64/bin/gh`; el token
  temporal está en `.state/tools/gh-token` (borrar cuando ya no se necesite).
- Actionlint no está instalado; reinstalar 1.7.12 si se modifica `.github/`.

```bash
npm ci && npm run setup && npm run check
npm run test:backend && npm run test:frontend && npm run test:runner
npm run infra:status
npm run test:backend:local
node backend/tests/integration-local.cjs verify-saved
npm run deploy:local
```

Playwright requiere Chromium y no está instalado; reinstalarlo bajo
`.state/tools` y definir `PLAYWRIGHT_BROWSERS_PATH` para los E2E.

## 6. Límites y riesgos conocidos

- Sin rollback automático ni limpieza de assets históricos. No mezclar un deploy
  manual desde otro checkout con uno del runner.
- Serverless v3 arrastra dependencias antiguas con vulnerabilidades conocidas,
  aceptadas para laboratorio.
- `.state/`, `.env*` y los respaldos están ignorados: nunca publicar credenciales.
- El healthcheck de LocalEmu no garantiza Lambdas activas; usar las esperas del
  script de despliegue.
- Las pruebas reales crean registros que se conservan (sin borrado en fase 1).

## 7. Estado de la tarea 0 y próximo paso

La tarea 0 se ejecutó en `feat/heraap-011`: base `heraap`, rol `heraap`, esquema
versionado, secreto `heraap/config` (15 claves) y lectura por SDK con IAM acotado.
Verificado: 21 pruebas unitarias, migraciones idempotentes, `secrets:publish`
idempotente y API real 201/200/400/404 tras el despliegue. Falta el PR a `main`.

La tarea 1 se ejecutó en `feat/heraap-012` con 49 pruebas de backend, 13 del
cliente, 22 E2E controlados y 2 E2E reales en escritorio y móvil. Falta el PR.

Próximo paso: solicitar aprobación de la tarea 2 (endurecimiento y control de
acceso) y crear `feat/heraap-013` desde `main` actualizado.
