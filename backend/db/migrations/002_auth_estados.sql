-- Estados temporales del flujo OAuth de Google (un solo uso).

CREATE TABLE IF NOT EXISTS auth_estados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estado_hash text NOT NULL UNIQUE,
  code_verifier text NOT NULL,
  nonce text NOT NULL,
  redirect_to text,
  expira_en timestamptz NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_estados_expira_idx ON auth_estados (expira_en);
