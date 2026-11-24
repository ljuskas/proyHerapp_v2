# Heraap

Laboratorio serverless para desarrollar con React, Lambda, API Gateway REST,
DynamoDB y S3 sobre LocalEmu. Esta fase prepara la estructura del repositorio
y un frontend base compilable. La aplicación de registros y el despliegue aún
no están implementados.

## Versiones fijadas

| Herramienta | Versión |
| --- | --- |
| Node.js de desarrollo | 22.23.5 |
| npm | 10.9.9 |
| React / React DOM | 19.3.1 |
| Vite | 8.3.8 |
| TypeScript | 5.9.3 |
| Serverless Framework | 3.40.0 |
| Adaptador serverless-localstack | 1.3.1 |
| LocalEmu previsto para Docker | 1.4.0 |

Los manifiestos usan versiones exactas y cada paquete incluye su lockfile.
Serverless v3 está sin mantenimiento y se reserva para este laboratorio sin cuenta
de Serverless. La compatibilidad con Lambda Node.js 22 requiere una adaptación
explícita y pruebas en la tarea de backend; aún no está validada.

## Requisitos

- Debian o WSL2 con Debian, Bash y Git.
- Node.js y npm en las versiones indicadas; se recomienda nvm.
- Acceso al registro npm para instalar dependencias.
- Docker y LocalEmu no son necesarios para compilar este esqueleto. Se verificarán
  en las tareas posteriores de infraestructura y despliegue.

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
npm run dev
```

Vite muestra la URL de desarrollo en la terminal y escucha en `127.0.0.1`
(puerto 5173 por defecto). En el servidor, acceder mediante un túnel SSH:

```bash
ssh -L 5173:127.0.0.1:5173 usuario@servidor
```

Abrir `http://127.0.0.1:5173` en el navegador del equipo cliente.

## Comprobaciones y build

```bash
npm run check
npm run build
npm --prefix frontend run preview
```

`check` valida versiones, tipos TypeScript, sintaxis del plugin inicial y sintaxis
Bash. `build` genera `frontend/dist/` con rutas relativas (`base: './'`).
El preview escucha en loopback (puerto 4173 por defecto).
Todavía no existen pruebas funcionales del backend ni de integración.

## Configuración

`.env.example` contiene únicamente credenciales ficticias (`test`), región
`us-east-1` y el endpoint local `http://127.0.0.1:4566`. La configuración se cargará
de forma explícita cuando se implemente el despliegue; copiar el archivo no
modifica los perfiles AWS del usuario.

`VITE_API_BASE_URL` se incorporará en el frontend cuando exista la API. El script
de despliegue generará `frontend/.env.production.local` con el output de la pila.
Los archivos `.env`, dependencias, builds y estado del emulador están excluidos de Git.

## Estructura

```text
frontend/                 React + Vite + TypeScript
  src/main.tsx            Punto de entrada del navegador
  src/App.tsx             Pantalla inicial
backend/                  Herramientas y esqueleto de serverless.yml
  handlers/               Reservado para las dos Lambdas
  lib/                    Reservado para utilidades de backend
  plugins/                Bloqueo temporal del despliegue
  tests/                  Reservado para pruebas del backend
infra/                    Documentación de la futura migración a Docker
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

## Próximas tareas aprobables

1. Migrar LocalEmu a Docker con respaldo, persistencia y red para las Lambdas.
2. Implementar backend, recursos e integración con Node.js 22.
3. Implementar el formulario y la consulta por ID.
4. Implementar despliegue local idempotente y pruebas de aceptación.
5. Preparar runner dedicado y workflow de despliegue exclusivo de `main`.

`npm run deploy:local` existe como punto de entrada, pero termina con código 1
y un mensaje claro hasta implementar esa tarea. No hay un workflow de despliegue
activo ni se ha registrado un runner en el servidor.

## Troubleshooting

- `EBADENGINE`: ejecutar `nvm install && nvm use`; comprobar también npm 10.9.9.
- Error de instalación: verificar acceso a `registry.npmjs.org` y usar `npm ci`
  dentro del paquete correspondiente.
- Error de Serverless indicando backend pendiente: es el bloqueo esperado de esta
  estructura inicial. No quitarlo para intentar un despliegue.
- LocalEmu inaccesible en 4566: revisar el servicio existente antes de arrancar otro
  proceso. La migración a Docker aún está pendiente; no ejecutar `docker compose up`
  de otro laboratorio que use el mismo puerto.
