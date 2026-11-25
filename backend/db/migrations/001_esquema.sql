-- Esquema inicial de Heraap. Idempotente: se aplica una sola vez por migración.

CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  nombre text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  proveedor text NOT NULL,
  proveedor_sub text NOT NULL,
  email text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT identidades_proveedor_sub_unico UNIQUE (proveedor, proveedor_sub)
);

CREATE TABLE IF NOT EXISTS sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expira_en timestamptz NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS sesiones_usuario_idx ON sesiones (usuario_id);
CREATE INDEX IF NOT EXISTS sesiones_expira_idx ON sesiones (expira_en);

CREATE TABLE IF NOT EXISTS auditoria (
  id bigserial PRIMARY KEY,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  accion text NOT NULL,
  resultado text NOT NULL,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb
);
