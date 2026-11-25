# Estado de Heraap y entrega a otro agente

Actualizado: 2026-11-25, America/Santiago. Repositorio público:
https://github.com/ljuskas/proyHerapp_v2.

## Leer primero

- Prompt original: `/mnt/storage2/DATA/proyectos-gpt/prompt_proyHeraap_v2.md`.
- Checkout de desarrollo: `/mnt/storage2/DATA/proyectos-gpt/proyHerapp_v2`.
- Implementación integrada desde `feat/heraap-007` mediante PR #5. Cierre
  documental integrado mediante PR #6 (squash `a77c04d`). Consultar
  `git status` y `git log -5` antes de actuar; este documento no fija su
  propio SHA.
- Cada tarea nueva requiere aprobación del usuario. Las tareas 7 y 9 y este
  archivo están aprobados. No iniciar otras tareas por inferencia.
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
| 7. CI/CD local | Completada: PR #5 fusionado, push main ejecutó validaciones y publicación en runner; SHA público y conservación comprobados |
| 8. Cierre documental | PR #6 fusionado por squash en `a77c04d`; run 45543517947 validó y publicó en runner |
| 9. Registro del despliegue de cierre | Este documento actualizado en `feat/heraap-009`, pendiente de PR a main |
| Entrega a otro agente | Este status.md, README y guía infra/runner.md |

## Cobertura del prompt original

- [x] Repositorio `proyHerapp_v2`, estructura y documentación reproducible.
- [x] `main` protegida: PR obligatorio sin aprobaciones externas (único
  desarrollador; cambio solicitado por el usuario), check `Verificar estructura y build`,
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
- [x] Clonar y desplegar como usuario runner: clon público limpio y despliegue
  real completos bajo heraap-runner; API y conservación comprobadas.
- [x] Workflow `.github/workflows/deploy-local.yml` implementado con push main,
  validaciones previas y publicación en runner dedicado.
- [x] Runner Linux instalado como servicio con cuenta propia y grupo Docker.
- [x] Integrar el código/workflow en main mediante PR, con autorización del usuario.
- [x] Run real de GitHub Actions por push main exitoso y SHA comparado con
  deployment.json; source github-actions, workingTreeDirty false.
- [x] Registro anterior conservado tras el despliegue automático.
- [ ] Validación adicional opcional: instalación WSL2 con systemd. El diseño es
  compatible y está probado en Debian; no se ha probado WSL2 por separado.

## Estado de GitHub e integración inicial

El usuario autorizó dejar listo y fusionar el PR #5. Se fusionó por squash,
sin bypass, con CI verde, el 2026-11-25T03:44:29Z. Commit inicial integrado:
`e5f857114d8b9bf9dd35a3b7709cd503309f39b5`.

El push a main inició automáticamente el
[run 45542049890](https://github.com/ljuskas/proyHerapp_v2/actions/runs/45542049890),
que terminó exitosamente: validaciones en GitHub y publicación en heraap-local-main.
El manifiesto HTTPS confirmó ese mismo SHA, origen github-actions y árbol limpio.
El registro de prueba previo siguió disponible.

Después, el usuario fusionó el PR #6 por squash con CI verde. `main` quedó en
`a77c04d436ca742c25867ede48cb553e29838485` y el push disparó el
[run 45543517947](https://github.com/ljuskas/proyHerapp_v2/actions/runs/45543517947):
«Verificar estructura y build» 1m20s, «Publicar main en LocalEmu» 1m06s, ambos
success. El manifiesto público pasó a `a77c04d…`, source github-actions, árbol
limpio, deployedAt 2026-11-25T04:00:13Z; el registro `58de73bf-…` se conservó.

El usuario confirmó que trabaja solo y autorizó quitar aprobaciones externas.
GitHub exige PR y CI, con 0 aprobaciones de terceros; se conservan las otras
protecciones, incluidas las aplicadas a administradores.

Las ramas antiguas contienen la historia anterior al squash. Para nuevas tareas,
crear la siguiente feature desde origin/main actualizado, no desde una feature
anterior al squash. El PR #1 permanece como remanente del scaffold inicial: no
fusionarlo, pues no contiene el estado final; su cierre es limpieza pendiente.

Commits previos relevantes:

- `7bf1e1b`: frontend funcional (feat/heraap-004).
- `5bf9420`: acceso por túnel HTTPS (feat/heraap-005).
- `26f3ac1`: despliegue completo (feat/heraap-006).

Los PR [#5](https://github.com/ljuskas/proyHerapp_v2/pull/5) y
[#6](https://github.com/ljuskas/proyHerapp_v2/pull/6) están fusionados. El
[PR #1](https://github.com/ljuskas/proyHerapp_v2/pull/1) sigue abierto y debe
cerrarse sin fusionar. Esta actualización de status.md se prepara en
`feat/heraap-009` y debe pasar por PR a main. No crear PR entre features ni
hacer push directo a main.

## Pendientes para el siguiente agente

No quedan entregables funcionales del prompt inicial pendientes en Debian.
Las nuevas funcionalidades requieren una tarea aprobada por el usuario.

- Último SHA publicado verificado: `a77c04d` (run 45543517947); consultar
  Actions y deployment.json antes de asumir otra cosa.
- Fusionar el PR de `feat/heraap-009` cuando el usuario lo autorice.
- Coordinar el cierre del PR #1 obsoleto; no fusionarlo.
- Opcional: validación independiente WSL2 con systemd.
- Mantener el runner y sus actualizaciones; no cambiar Serverless ni ejecutar
  audit fix --force sin tratarlo como una tarea nueva.

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

Playwright requiere Chromium y no está instalado en este checkout. En la sesión
anterior se usó `/tmp/heraap-playwright-browsers`, pero `/tmp` se vació; definir
`PLAYWRIGHT_BROWSERS_PATH` tras reinstalarlo dentro de `.state/tools`. Escritorio y
móvil tienen escenarios reales; los controlados se omiten en ese modo por diseño.
Para ejecutarlos: npm run test:frontend:e2e.

Herramientas reinstaladas el 2026-11-25 en `.state/tools/` (ignorado por git), porque
`/tmp` se vacía entre sesiones:

- Node fijado: `.state/tools/node-v22.23.5-linux-x64/bin` (npm 10.9.9). Añadirlo al
  PATH antes de `npm ci`, `npm run check` o los tests.
- GitHub CLI 2.105.0: `.state/tools/gh_2.105.0_linux_amd64/bin/gh`, sin sesión
  autenticada. No mostrar tokens ni archivos de config. La conexión GitHub del
  agente es independiente y el usuario prefiere fusionar los PR él mismo.
- Actionlint no está reinstalado; si se toca `.github/`, reinstalar 1.7.12 en
  `.state/tools/` y validar con los labels de `.github/actionlint.yaml`.

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
- Runner online en la API GitHub, servicio activo y habilitado al arranque.
- Clon público limpio en `/var/lib/heraap-runner/acceptance`, commit de código
  `9380ff3e76d6f74ab5db81d23f08bab2f8ce5a53`. Ejecutado como heraap-runner con
  Node fijado en `/var/lib/heraap-runner/tools/node-v22.23.5-linux-x64/bin`.
- npm ci raíz y deploy completo: correctos; Lambdas desplegadas desde el clon.
- API real: 201/200/400/404 y CORS correctos; se creó el registro de prueba
  `bdb22f1c-8dbf-46a9-98c7-cf2f8af8d1c1` en ese checkout.
- Registro anterior `58de73bf-8740-4afa-9d1d-39870a524d70` conservado tras desplegar.
- Manifiesto público consultado: commit 9380ff3, workingTreeDirty false,
  source manual, fecha 2026-11-25T03:37:35Z. Esto fue una prueba manual con el
  usuario del runner, no una ejecución disparada por GitHub Actions.
- El manifiesto corresponde al clon probado en 9380ff3. Consultar git log para
  cambios posteriores de documentación y operación del runner; que cambie el
  HEAD de una feature no implica un despliegue automático.
- Primer run automático real 45542049890: success. Validación hosted 1m23s y
  publicación en runner heraap-local-main 1m41s; hook previo al job aprobado.
- Manifiesto público comprobado mediante curl: commit e5f857114d8b9bf9dd35a3b7709cd503309f39b5,
  source github-actions, workingTreeDirty false, fecha 2026-11-25T03:47:31Z,
  runUrl correcto. Un acceso con urllib devolvió 403; curl accedió correctamente.
- verify-saved posterior al run confirmó el registro previo 58de73bf.
- Estos son resultados de la primera integración. Para versiones posteriores,
  consultar Actions y el manifiesto público; un cambio de feature no despliega.
- Verificación del 2026-11-25 tras fusionar el PR #6: `npm ci`, `setup` y
  `npm run check` correctos con Node 22.23.5/npm 10.9.9; test:backend 9/9,
  test:frontend 9/9, test:runner 3/3.
- Run 45543517947 success; manifiesto en a77c04d con source github-actions y
  árbol limpio; `index.html` respondió 200; GET del registro 58de73bf devolvió
  200 con sus datos; verify-saved OK.
- No se ejecutaron los E2E de Playwright: Chromium no estaba instalado.
