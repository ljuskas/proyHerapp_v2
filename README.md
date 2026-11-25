# Heraap

Laboratorio serverless para desarrollar con React, Lambda, API Gateway REST,
DynamoDB y S3 sobre LocalEmu. Incluye backend de creación y consulta de registros,
infraestructura Docker con persistencia y un frontend funcional de creación y consulta.
La aplicación se puede publicar manualmente en S3 local. El comando de despliegue
completo y la automatización desde `main` siguen pendientes.

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
| SDK AWS v3 DynamoDB y DocumentClient | 3.1177.0 |
| LocalEmu en Docker | 1.4.0 (digest fijado en Compose) |

Los manifiestos usan versiones exactas y cada paquete incluye su lockfile.
Serverless v3 está sin mantenimiento y se reserva para este laboratorio sin cuenta
de Serverless. `backend/plugins/local-only.cjs` adapta el esquema para Node.js 22
y bloquea destinos, credenciales, regiones y stages distintos de los del laboratorio.

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
`us-east-1` y el endpoint local `http://127.0.0.1:4566`. La configuración se cargará
de forma explícita cuando se implemente el despliegue; copiar el archivo no
modifica los perfiles AWS del usuario.

`VITE_API_BASE_URL` se define en `frontend/.env.local` para desarrollo y puede
sobrescribirse en `frontend/.env.production.local` para el build. La API debe ser
accesible desde el navegador del usuario. El futuro despliegue completo generará
ese archivo a partir de los outputs de la pila.
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

`main` será la base de PR. La política prevista exige una revisión del otro
desarrollador, el check `Verificar estructura y build`, resolución de conversaciones
y bloqueo de force-push y eliminación de la rama, sin excepciones de administrador.
La protección efectiva se deberá confirmar en GitHub, no solo en esta documentación.
Su configuración declarada está en `.github/main-protection.json`. Tras crear el
repositorio público y publicar la base de `main`, un administrador autenticado
puede aplicarla con:

```bash
gh api --method PUT repos/ljuskas/proyHerapp_v2/branches/main/protection \
  --input .github/main-protection.json
```

No se permiten excepciones de administrador. El primer PR también necesitará una
revisión de otro colaborador antes del merge; registrar al segundo desarrollador
requiere conocer su usuario de GitHub.

La base local de `main` se inicializa con un commit vacío para poder presentar el
primer cambio completo mediante PR desde `feat/heraap-001`.
Si una tarea depende de un PR todavía pendiente, su rama parte de ese cambio y
su PR apunta temporalmente a la rama anterior. Tras integrar la dependencia, se
debe cambiar la base a `main`. Las comprobaciones de PR también cubren esas ramas.

## Próximas tareas aprobables

1. Implementar despliegue local completo y pruebas de aceptación.
2. Preparar runner dedicado y workflow de despliegue exclusivo de `main`.

`npm run deploy:local` existe como punto de entrada, pero termina con código 1
y un mensaje claro hasta implementar esa tarea. No hay un workflow de despliegue
activo ni se ha registrado un runner en el servidor.

## Troubleshooting

- `EBADENGINE`: ejecutar `nvm install && nvm use`; comprobar también npm 10.9.9.
- Error de instalación: verificar acceso a `registry.npmjs.org` y usar `npm ci`
  dentro del paquete correspondiente.
- Error de Serverless sobre stage, endpoint o credenciales: usar
  `npm run deploy:backend`, que configura el proceso para el laboratorio.
- LocalEmu inaccesible en 4566: ejecutar `bash scripts/localemu.sh status` y `logs`.
  No arrancar otro laboratorio en el mismo puerto ni el antiguo proceso Python.
