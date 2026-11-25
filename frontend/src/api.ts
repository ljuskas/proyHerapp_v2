export interface Registro {
  id: string;
  nombre: string;
  createdAt: string;
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
}

export class ApiError extends Error {
  status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function isRegistro(value: unknown): value is Registro {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && Boolean(item.id)
    && typeof item.nombre === 'string' && Boolean(item.nombre)
    && typeof item.createdAt === 'string' && !Number.isNaN(Date.parse(item.createdAt));
}

function isUsuario(value: unknown): value is Usuario {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && Boolean(item.id)
    && typeof item.email === 'string' && Boolean(item.email)
    && typeof item.nombre === 'string' && Boolean(item.nombre);
}

export function createApi(baseUrl: string | undefined, fetcher: typeof fetch = fetch) {
  function base(): string {
    if (!baseUrl?.trim()) throw new ApiError('El servicio de registros no está disponible en este entorno.');
    return baseUrl.trim().replace(/\/+$/, '');
  }

  // Las cookies solo viajan al mismo origen: la app publicada usa ruta relativa.
  function credentialsMode(): RequestCredentials {
    const raw = baseUrl?.trim();
    if (!raw) return 'omit';
    if (!/^https?:\/\//i.test(raw)) return 'include';
    if (typeof window === 'undefined') return 'omit';
    return new URL(raw).origin === window.location.origin ? 'include' : 'omit';
  }

  async function call(path: string, options: RequestInit, signal?: AbortSignal): Promise<Response> {
    const target = base() + path;
    try {
      return await fetcher(target, {
        credentials: credentialsMode(),
        ...options,
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApiError('La respuesta está tardando más de lo esperado. Inténtalo de nuevo.');
      }
      throw new ApiError('No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  async function request(path: string, options: RequestInit, signal?: AbortSignal): Promise<Registro> {
    const response = await call(path, options, signal);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError('Recibimos una respuesta inesperada. Inténtalo de nuevo.');
    }
    if (!response.ok) {
      if (response.status === 401) throw new ApiError('Inicia sesión para continuar.', 401);
      if (response.status === 404) throw new ApiError('No encontramos un registro con ese ID.', 404);
      if (response.status === 400) throw new ApiError('Revisa los datos e inténtalo de nuevo.', 400);
      throw new ApiError('No pudimos completar la solicitud. Inténtalo de nuevo.', response.status);
    }
    if (!isRegistro(body)) throw new ApiError('Recibimos una respuesta inesperada. Inténtalo de nuevo.');
    return body;
  }

  return {
    loginUrl() {
      return base() + '/auth/google/start';
    },

    async session(signal?: AbortSignal): Promise<Usuario | null> {
      const response = await call('/sesion', { method: 'GET' }, signal);
      if (response.status === 401) return null;
      if (!response.ok) throw new ApiError('No pudimos comprobar tu sesión.', response.status);
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new ApiError('Recibimos una respuesta inesperada. Inténtalo de nuevo.');
      }
      const usuario = (body as { usuario?: unknown } | null)?.usuario;
      if (!isUsuario(usuario)) throw new ApiError('Recibimos una respuesta inesperada. Inténtalo de nuevo.');
      return usuario;
    },

    async logout(signal?: AbortSignal): Promise<void> {
      const response = await call('/logout', { method: 'POST' }, signal);
      if (!response.ok && response.status !== 401) {
        throw new ApiError('No pudimos cerrar la sesión. Inténtalo de nuevo.', response.status);
      }
    },

    createRegistro(nombre: string, signal?: AbortSignal) {
      if (!nombre.trim()) return Promise.reject(new ApiError('Escribe un nombre para el registro.', 400));
      return request('/registros', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim() }),
      }, signal);
    },

    getRegistro(id: string, signal?: AbortSignal) {
      if (!id.trim()) return Promise.reject(new ApiError('Escribe el ID que quieres consultar.', 400));
      return request('/registros/' + encodeURIComponent(id.trim()), { method: 'GET' }, signal);
    },
  };
}
