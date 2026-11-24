# Backend de Heraap

Directorio reservado para Lambda Node.js 22, API Gateway REST y DynamoDB.
El punto de entrada de infraestructura es `serverless.yml`.

## Estado

Esta tarea inicial agrega la estructura y las herramientas, sin handlers ni recursos.
El plugin `plugins/scaffold-only.cjs` detiene los comandos de servicio de Serverless
antes de desplegar. No se debe quitar hasta implementar el bloqueo de stage local,
endpoints y credenciales ficticias en la tarea de backend.

Serverless 3.40.0 no reconoce `nodejs22.x` en su esquema. La adaptación acotada del
esquema y su validación funcional con LocalEmu siguen pendientes.

## Directorios y comprobación

- `handlers/`: futuros puntos de entrada `createRegistro` y `getRegistro`.
- `lib/`: futuro cliente DynamoDB y respuestas HTTP compartidas.
- `plugins/`: bloqueo temporal; posteriormente, adaptación y guardas del entorno local.
- `tests/`: futuras pruebas de validación, errores y operaciones DynamoDB.

Con Node 22.23.5 y npm 10.9.9:

```bash
npm ci
npm run check
```

`check` revisa la sintaxis del plugin inicial. Todavía no existen pruebas funcionales.
SDK AWS v3, tabla por stage, IAM mínimo, CORS y logging se incorporarán en la tarea aprobada correspondiente.
