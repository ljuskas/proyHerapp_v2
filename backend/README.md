# Backend de Heraap

Lambda Node.js 22, API Gateway REST y DynamoDB sobre LocalEmu 1.4.0. Entrada de
infraestructura: `serverless.yml`. No se utiliza ninguna cuenta AWS real.

## Versiones y estructura

- Node.js de desarrollo: 22.23.5; runtime Lambda: `nodejs22.x`.
- npm: 10.9.9; Serverless Framework: 3.40.0; serverless-localstack: 1.3.1.
- `@aws-sdk/client-dynamodb` y `@aws-sdk/lib-dynamodb`: 3.1177.0.
- `handlers/createRegistro.js` y `handlers/getRegistro.js`: puntos de entrada Lambda.
- `lib/`: cliente DynamoDB, respuestas CORS y logging estructurado.
- `plugins/local-only.cjs`: adaptación de runtime y restricciones del laboratorio.
- `tests/`: pruebas unitarias e integración HTTP local.

Serverless v3 se usa únicamente para el laboratorio. El plugin agrega
`nodejs22.x` al esquema sin desactivar la validación del resto de la configuración.
El adaptador dirige los servicios AWS a LocalEmu y una guarda SDK v2 bloquea las
solicitudes a destinos distintos de `http://127.0.0.1:4566`.

## Preparación y despliegue

Desde la raíz del repositorio, con Node/npm en las versiones indicadas:

```bash
npm ci
npm run setup
npm run infra:up
npm run test:backend
npm run deploy:backend
```

El despliegue exige LocalEmu saludable, fija credenciales ficticias `test` para su
proceso y descarta perfiles, sesiones y proxies heredados. No cambia la configuración
AWS del usuario. El único stage y región admitidos son `local` y `us-east-1`.
No ejecutar Serverless con credenciales reales.

El script imprime la URL local y guarda los outputs de CloudFormation en
`.state/backend-outputs.json`, excluido de Git. Aún no publica el frontend ni
registra un runner: el despliegue de la aplicación completa y su automatización
corresponden a tareas posteriores.

Recursos de la pila `heraap-local`:

| Recurso | Nombre / comportamiento |
| --- | --- |
| Tabla | `heraap-registros-local`, PK `id` string, modo on demand |
| Bucket frontend | `heraap-frontend-local`, preparado para servir archivos estáticos |
| Lambda POST | `heraap-local-createRegistro`, permiso DynamoDB `PutItem` |
| Lambda GET | `heraap-local-getRegistro`, permiso DynamoDB `GetItem` |
| Logs | Grupos por función, retención de 7 días |

Los roles también permiten escribir logs únicamente en el grupo de su función.
La tabla tiene `DeletionPolicy` y `UpdateReplacePolicy: Retain`. Un despliegue
normal actualiza la pila sin borrar los registros. La configuración IAM está
declarada con permisos mínimos; el emulador mantiene su configuración global de
IAM, sin activar enforcement en esta tarea.

## Contrato HTTP

| Petición | Resultado |
| --- | --- |
| `POST /registros`, JSON `{"nombre":"Ejemplo"}` | 201 con `{id,nombre,createdAt}` |
| Nombre ausente, vacío o que no sea texto | 400 |
| Cuerpo JSON inválido | 400 |
| `GET /registros/{id}` existente | 200 con el registro |
| ID inexistente | 404 |
| Error interno | 500 con mensaje genérico |

El nombre se guarda sin espacios en los extremos. El ID es UUID v4 y `createdAt`
es ISO 8601 UTC. Las lecturas usan `ConsistentRead: true`. Los handlers producen
logs JSON con `requestId`; los detalles de error no aparecen en la respuesta HTTP.
Las respuestas y preflight incluyen CORS para GET/POST y el header Content-Type.

## Probar con curl

Obtener el ID de la API en el servidor:

```bash
API_ID=$(bash scripts/localemu.sh aws cloudformation describe-stacks \
  --stack-name heraap-local \
  --query "Stacks[0].Outputs[?OutputKey=='ApiId'].OutputValue | [0]" --output text)
API="http://127.0.0.1:4566/_aws/execute-api/${API_ID}/local"
```

Desde otro equipo, reemplazar `127.0.0.1` por la IP LAN configurada del servidor.
La ruta contiene el ID real de la API; no se debe usar la URL raíz del emulador.

```bash
# Crear. Copiar el campo id que devuelve la respuesta.
curl -i -X POST "$API/registros" \
  -H 'Content-Type: application/json' -d '{"nombre":"Prueba Heraap"}'

# Consultar el mismo registro, incluso después de recargar el navegador.
ID='copiar-id-devuelto'
curl -i "$API/registros/$ID"

# Validación 400 y consulta 404.
curl -i -X POST "$API/registros" \
  -H 'Content-Type: application/json' -d '{"nombre":""}'
curl -i "$API/registros/00000000-0000-4000-8000-000000000000"

# Preflight del navegador.
curl -i -X OPTIONS "$API/registros" \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type'
```

## Pruebas y diagnóstico

```bash
npm run test:backend
npm run test:backend:local
# Repetir despliegue y verificar que el registro de integración permanece.
npm run deploy:backend -- --force
node backend/tests/integration-local.cjs verify-saved
```

Las pruebas unitarias cubren validación, UUID, fecha, 404, 500 genérico, CORS,
logging correlacionado, lectura consistente y bloqueo de solicitudes externas.
La prueba HTTP crea un registro de laboratorio y lo conserva en DynamoDB para
comprobar el redeploy; su ID queda en `.state/backend-smoke.json`.

El dashboard del emulador permite explorar la tabla y las funciones. También:

```bash
bash scripts/localemu.sh aws logs tail /aws/lambda/heraap-local-createRegistro --since 10m
bash scripts/localemu.sh aws logs tail /aws/lambda/heraap-local-getRegistro --since 10m
```

LocalEmu 1.4.0 puede perder directorios temporales de buckets vacíos tras recrear
el contenedor, incluyendo el bucket interno de código Lambda. Los hooks de
`infra/init/` preparan el directorio interno y los directorios de buckets
restaurados antes de usar el servicio. Aplicar cambios de infraestructura con
`npm run infra:up` antes de desplegar si el contenedor fue creado con una
configuración anterior.

Verificación de esta fase: 9 pruebas unitarias satisfactorias; API real con
201/200/400/404 y CORS; redeploy efectivo conservando un registro; restauración
de las dos Lambdas y los registros tras recrear/reiniciar LocalEmu; consulta por
LAN y lectura HTTP anónima de un objeto temporal del bucket frontend. Los casos
500 se comprueban con fallos simulados de almacenamiento en las pruebas unitarias.
