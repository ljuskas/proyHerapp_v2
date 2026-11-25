# Estado de Heraap y entrega a otro agente

Actualizado: 2026-11-25, America/Santiago. Repositorio público:
https://github.com/ljuskas/proyHerapp_v2.

## Leer primero

- Prompt original: `/mnt/storage2/DATA/proyectos-gpt/prompt_proyHeraap_v2.md`.
- Checkout de desarrollo: `/mnt/storage2/DATA/proyectos-gpt/proyHerapp_v2`.
- Rama de esta tarea: `feat/heraap-007`. Consultar `git status` y `git log -5`
  antes de actuar; este documento no fija su propio SHA.
- Cada tarea nueva requiere aprobación del usuario. La tarea 7 y este archivo
  están aprobados. No iniciar otras tareas por inferencia.
- Commits semánticos en español, directamente en `feat/heraap-NNN`.
- PR únicamente de feature a main. Nunca PR encadenados entre features.
- El despliegue automático debe ocurrir al fusionar en main, no al abrir/actualizar
  un PR. PR y validaciones se ejecutan en GitHub; servidor solo para main.
- No fusionar ni evadir protecciones sin autorización. No tocar AWS real.

## Decisiones aprobadas que sustituyen al prompt

| Prompt | Decisión vigente |
| --- | --- |
| Node.js 20 | Node.js 22.23.5, npm 10.9.9 y Lambda nodejs22.x |
| HTTP API v2 | API Gateway REST desde el inicio |
| Serverless sin versión | Serverless 3.40.0, sin cuenta, solo laboratorio |
| `feature/*` | `feat/heraap-[correlativo]` |
| Instalación Python | LocalEmu 1.4.0 Docker, imagen fijada por digest |
| PR encadenados durante tareas anteriores | Reemplazado por PR exclusivamente a main |
| Escribir `.env.production.local` en deploy | Variable VITE_API_BASE_URL del proceso, sin modificar archivos locales |
| URL absoluta API | Ruta relativa al origen, funciona por LAN y túnel HTTPS |
| Sync con borrado de archivos | Subir assets antes del HTML y conservar versiones anteriores |

## Tareas realizadas del plan de trabajo

| Tarea | Estado y evidencia |
| --- | --- |
| 1. Revisar prompt y propuesta | Completada con las decisiones aprobadas anteriores |
| 2. Repositorio y estructura | Repo público, frontend/backend/scripts/infra, lockfiles, README, `.env.example`, `.nvmrc`, CI y protección main |
| 3. LocalEmu Docker | Contenedor saludable, red y volumen persistentes, pruebas de servicios y persistencia; migración Python conservada como respaldo |
| 4. Backend | REST, dos Lambdas, DynamoDB y S3 declarados; validaciones, UUID, lecturas consistentes, CORS, IAM por función y logs estructurados |
| 5. Frontend | React/Vite/TS; crear/consultar/copiar ID, recuperación tras recarga, loading/error/success, responsive y accesibilidad; tests y capturas |
| Corrección Cloudflare | Frontend publicado con ruta API del mismo origen; crear/consultar por HTTPS verificado en escritorio y móvil |
| 6. Deploy completo | `npm run deploy:local`, npm ci, deploy backend, outputs, build, publicación, caché y locks; dos despliegues y conservación de registros comprobados |
| 7. CI/CD local | Workflow y runner dedicado instalados; ver sección de validación y pendiente de integración más abajo |
| Entrega a otro agente | Este status.md, README y guía infra/runner.md |

## Cobertura del prompt original

- [x] Repositorio `proyHerapp_v2`, estructura y documentación reproducible.
- [x] `main` protegida: 1 aprobación, check `Verificar estructura y build`,
  revisión obsoleta invalidada, conversaciones resueltas, historia lineal,
  sin force-push/eliminación; se aplica también a administradores.
- [x] Backend declarado en `backend/serverless.yml`, stage local, endpoint y
  credenciales ficticias. Lambdas JavaScript, alternativa admitida por el prompt.
- [x] Tabla `heraap-registros-local`, PK id string, política Retain.
- [x] POST `/registros`: trim y validación nombre, UUID v4, fecha ISO, 201/400.
- [x] GET `/registros/{id}`: ConsistentRead true, 200/404.
- [x] SDK v3 DynamoDB, TABLE_NAME, IAM PutItem/GetItem por función, logs JSON
  con requestId, errores internos genéricos 500, preflight CORS.
- [x] Frontend funcional servido en S3 con base relativa y configuración Vite.
- [x] Script único instala frontend/backend, comprueba entorno, despliega,
  captura outputs, construye, publica e imprime URLs.
- [x] Versiones fijadas y credenciales ficticias acotadas al proceso.
- [x] Criterios funcionales: crear/recargar/consultar, 400/404, CORS y assets S3.
- [x] Repetir deploy conserva registros; comprobado en tarea 6.
- [ ] Clonar y desplegar como usuario runner: validación en curso al iniciar
  esta entrega; actualizar esta línea con el resultado antes de finalizar.
- [x] Workflow `.github/workflows/deploy-local.yml` implementado con push main,
  validaciones previas y publicación en runner dedicado.
- [x] Runner Linux instalado como servicio con cuenta propia y grupo Docker.
- [ ] Integrar el código/workflow en main mediante PR aprobado.
- [ ] Verificar un run real de GitHub Actions por push main y comparar su SHA
  con `deployment.json`. No declarar este criterio cumplido por una prueba manual.
- [ ] Verificar otra integración automática y conservación del registro anterior.
- [ ] Compatibilidad WSL2 con systemd: diseño compatible, ejecución comprobada
  en Debian del servidor; no se ha realizado una instalación WSL2 independiente.

## Estado de GitHub e integración inicial

Al comenzar esta tarea, main seguía en el commit vacío
`1351967a99864b922c7f3634030b3e21db77a5d3`. Solo estaba abierto el PR #1 de
`feat/heraap-001` a main. No se han integrado automáticamente las ramas ni se
han eludido protecciones.

Las ramas 002 a 007 acumulan trabajo previo. Para integrar la versión completa,
preparar un PR desde la última feature hacia main y revisar el diff completo.
Coordinar el cierre del PR #1 si queda reemplazado. No integrar únicamente el
PR #1 esperando que contenga las tareas posteriores. Hace falta la aprobación
de otro colaborador; no se ha identificado en esta sesión su usuario GitHub.
Una vez aprobada y fusionada la versión completa, comprobar el workflow.

Commits previos relevantes:

- `7bf1e1b`: frontend funcional (feat/heraap-004).
- `5bf9420`: acceso por túnel HTTPS (feat/heraap-005).
- `26f3ac1`: despliegue completo (feat/heraap-006).

No crear nuevos PR entre features. Esta tarea deja commits en feat/heraap-007;
la integración hacia main sigue requiriendo revisión.

## Entorno operativo

- Servidor Debian, IP LAN `192.168.100.9`.
- Contenedor `heraap-localemu`, red `heraap-local`, alias Docker `localemu`.
- Volumen persistente `heraap-localemu-data`; no ejecutar down -v ni borrar tabla.
- API REST ID actual `xsmydwgk1h`; el deploy obtiene outputs, no asumir que nunca cambia.
- API host: `http://127.0.0.1:4566/_aws/execute-api/xsmydwgk1h/local`.
- Frontend público: `https://local.deptofeliz.uk/heraap-frontend-local/index.html`.
- Frontend LAN: `http://192.168.100.9:4566/heraap-frontend-local/index.html`.
- Dashboard LAN: `http://192.168.100.9:4566/_localemu/dashboard`.
- Cloudflare Tunnel existente y administrado remotamente: servicio HTTP hacia
  `192.168.100.9:4566`. HTTPS al origen daba error de certificado y 502.
  El navegador usa HTTPS; la API del frontend debe compartir ese origen.
- El túnel actualmente publica el puerto LocalEmu completo, incluido dashboard.
- Runner: `heraap-local-main`, usuario `heraap-runner`, app `/opt/heraap-runner`,
  home `/var/lib/heraap-runner`, label `heraap-local-main`.
- Servicio: `actions.runner.ljuskas-proyHerapp_v2.heraap-local-main.service`.
- Runner inicial 2.338.2, actualizaciones automáticas habilitadas.
- Hook: `/etc/heraap-runner/job-started.sh`, propiedad de root; rechaza PR,
  forks, feature y otros workflows. Fuente: scripts/runner-job-started.sh.
- El runner no usa tokens GitHub del administrador ni credenciales AWS reales.
- Node global del servidor no coincide con el pin; usar nvm o el binario fijado.

## Comandos para continuar

Desde la raíz del repo, con Node.js 22.23.5/npm 10.9.9:

```bash
npm ci
npm run setup
npm run check
npm run test:backend
npm run test:frontend
npm run test:runner
npm run infra:status
npm run deploy:local
npm run test:backend:local
node backend/tests/integration-local.cjs verify-saved
HERAAP_E2E_FRONTEND_URL=https://local.deptofeliz.uk/heraap-frontend-local/index.html \
  npm run test:frontend:e2e:local
```

Playwright requiere Chromium. En esta máquina se instaló en
`/tmp/heraap-playwright-browsers`: definir PLAYWRIGHT_BROWSERS_PATH para usarlo.
Escritorio y móvil tienen escenarios reales; los escenarios controlados se omiten
en ese modo por diseño. Para ejecutarlos: npm run test:frontend:e2e.

Herramientas temporales de la sesión, pueden desaparecer tras reiniciar:

- Node fijado: `/tmp/heraap-tools/node-v22.23.5-linux-x64/bin`.
- GitHub CLI: `/tmp/heraap-tools/gh_2.105.0_linux_amd64/bin/gh`.
- Config CLI autenticada: `GH_CONFIG_DIR=/tmp/heraap-tools/github-auth`.
  No mostrar sus archivos ni tokens. La conexión GitHub del agente es independiente.
- Actionlint 1.7.12: `/tmp/heraap-tools/actionlint`; labels en `.github/actionlint.yaml`.

La instalación del runner y operaciones Docker requirieron ejecución fuera del
sandbox. No cambiar permisos del socket Docker. No tocar otros servicios del host.
Consultar infra/runner.md para servicio, registro y diagnóstico.

## Datos, respaldos y limitaciones

- `.state/` y `.env*` locales están ignorados; no publicar credenciales ni backups.
- Outputs backend: `.state/backend-outputs.json`. Último manifiesto de publicación:
  `.state/last-deployment.json` en el checkout que desplegó.
- `deployment.json` público permite identificar el commit y run; no certifica
  que todos los pasos posteriores del workflow hayan pasado.
- Registro de prueba anterior: `58de73bf-8740-4afa-9d1d-39870a524d70`.
- Las pruebas reales crean registros que se conservan. No hay auth, listado ni
  eliminación: alcance de fase 1 del prompt.
- Respaldo migración: `.state/migrations/20261124T233948Z/`; instalación Python
  anterior detenida en `/mnt/storage2/DATA/proyectos-gpt/localemu-lab`.
  No usar su script stop: puede afectar procesos del contenedor.
- Hooks infra/init recrean directorios S3 requeridos tras restauración de LocalEmu.
  El healthcheck por sí solo no garantiza Lambdas activas; usar wait-functions.
- Serverless v3 tiene dependencias antiguas; npm audit informa vulnerabilidades
  conocidas. Versión aceptada para laboratorio; no aplicar audit fix --force.
- No hay rollback automático ni limpieza de assets históricos. No mezclar un
  deploy manual desde otro checkout con un despliegue del runner.

## Verificaciones de esta entrega

- Tests del hook: permiten contexto main y rechazan PR, pull_request_target,
  workflow_dispatch, feature, otro repo/workflow, payload inconsistente y borrado.
- Tipos y sintaxis: npm run check.
- Workflows: actionlint 1.7.12 con label local declarado.
- Instalación servicio y acceso Docker del usuario runner: verificados.
- Pendiente registrar aquí el resultado del clon limpio y de la publicación manual
  con ese usuario. El run automático real queda pendiente hasta integrar en main.
