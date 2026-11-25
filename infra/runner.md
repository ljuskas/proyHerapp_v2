# Runner dedicado de Heraap

Este runner pertenece exclusivamente a `ljuskas/proyHerapp_v2`, con nombre y
label `heraap-local-main`. Usuario Linux `heraap-runner`, directorio de aplicación
`/opt/heraap-runner`, home `/var/lib/heraap-runner`, servicio systemd instalado
con `svc.sh`. No comparte las credenciales GitHub del administrador ni perfiles AWS.
El usuario pertenece al grupo Docker para operar LocalEmu; ese acceso permite
administrar Docker del host. Solo los cambios revisados e integrados en main
deben ejecutarse allí.

## Flujo

1. Commit directamente a `feat/heraap-NNN`.
2. PR únicamente hacia `main`; `checks.yml` usa `ubuntu-24.04` de GitHub.
3. La aprobación y fusión producen un push a `main`.
4. `deploy-local.yml` vuelve a validar ese commit mediante el workflow reutilizable
   de comprobaciones, todavía en GitHub. Si falla, no inicia el job del servidor.
5. El job local descarga exactamente `github.sha`, prepara Node.js 22.23.5,
   ejecuta `npm run deploy:local` y comprueba la API real.

No hay triggers de PR ni disparo manual para el despliegue. El hook instalado en
`/etc/heraap-runner/job-started.sh`, propiedad de root y fuera del checkout,
rechaza eventos distintos de un push a main del workflow previsto y comprueba
repositorio, ref y SHA del payload antes del primer paso. Los tests del hook están
en `scripts/test-runner-hook.py`. Este hook agrega una comprobación del contexto;
no convierte Docker ni los trabajos de main en un entorno aislado.

La concurrencia del workflow evita despliegues simultáneos sin interrumpir uno
en curso. No ejecutar manualmente un despliegue desde otro checkout mientras
el runner despliega. El lock del script cubre ejecuciones del mismo checkout.

## Instalación reproducible

Requiere Linux x86_64 con systemd, Docker/Compose, Python 3, Bash, Git, curl,
tar y util-linux; conexión saliente a GitHub y npm. El contenedor LocalEmu debe
estar saludable y ya configurado; el workflow no arranca ni recrea infraestructura.
Runner inicial 2.338.2, archivo oficial con SHA-256 comprobado por el instalador.
Se conservan las actualizaciones automáticas de GitHub Runner.

Con GitHub CLI autenticado como administrador del repositorio, desde la raíz:

```bash
gh api --method POST repos/ljuskas/proyHerapp_v2/actions/runners/registration-token \
  --jq .token | sudo bash scripts/install-runner.sh
```

El token temporal viaja por stdin; no guardarlo en Git ni imprimirlo. El script
no registra de nuevo un runner ya configurado. Las credenciales persistentes se
guardan en `/opt/heraap-runner`, con acceso limitado al usuario del servicio.
El tool cache queda bajo `/var/lib/heraap-runner/tools`, no en `/tmp`.
No se instala como root ni se habilita `RUNNER_ALLOW_RUNASROOT`.

## Operación

```bash
sudo /opt/heraap-runner/svc.sh status
sudo /opt/heraap-runner/svc.sh stop
sudo /opt/heraap-runner/svc.sh start
gh api repos/ljuskas/proyHerapp_v2/actions/runners \
  --jq '.runners[] | {name,status,busy}'
```

Ejecutar `svc.sh` desde `/opt/heraap-runner` si la versión instalada lo exige.
Los logs del servicio se consultan con `journalctl -u 'actions.runner.*'` y
los diagnósticos del runner están en `/opt/heraap-runner/_diag`.
Cambiar el hook en el repositorio no actualiza el instalado: copiarlo como root
y mantener sus permisos 755. Reiniciar el servicio tras cambiar su `.env`.

## Verificar una publicación automática

Tras integrar el workflow en main, fusionar un PR aprobado y comprobar:

- Actions muestra `Desplegar en LocalEmu`, validaciones y publicación exitosas.
- El resumen del job muestra el SHA y las URLs.
- `https://local.deptofeliz.uk/heraap-frontend-local/deployment.json` muestra
  ese SHA, `source: github-actions`, `workingTreeDirty: false` y el enlace al run.
- Crear un registro, recargar y consultarlo desde el frontend.
- Tras otra integración, cambia el SHA del manifiesto y sigue disponible el registro.

`deployment.json` se publica sin caché después de verificar el HTML. También se
guarda `.state/last-deployment.json` en el checkout que desplegó. En despliegues
manuales indica `source: manual` y si había cambios sin commit. El manifiesto
describe la publicación, no sustituye el estado final del job: la comprobación
posterior de API aún puede fallar. Un fallo de despliegue no implica rollback.

## Referencias

- [Instalar el runner como servicio](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/configure-the-application).
- [Hooks previos al job](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/run-scripts).
- [Runner oficial 2.338.2](https://github.com/actions/runner/releases/tag/v2.338.2).
