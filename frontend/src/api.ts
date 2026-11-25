export interface Registro {
  id: string;
  nombre: string;
  createdAt: string;
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

export function createApi(baseUrl: string | undefined, fetcher: typeof fetch = fetch) {
  async function request(path: string, options: RequestInit, signal?: AbortSignal): Promise<Registro> {
    if (!baseUrl?.trim()) throw new ApiError('El servicio de registros no está disponible en este entorno.');
    const base = baseUrl.trim().replace(/\/+$/, '');
    let response: Response;
    try {
      response = await fetcher(base + path, {
        ...options,
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApiError('La respuesta está tardando más de lo esperado. Inténtalo de nuevo.');
      }
      throw new ApiError('No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.');
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError('Recibimos una respuesta inesperada. Inténtalo de nuevo.');
    }
    if (!response.ok) {
      if (response.status === 404) throw new ApiError('No encontramos un registro con ese ID.', 404);
      if (response.status === 400) throw new ApiError('Revisa los datos e inténtalo de nuevo.', 400);
      throw new ApiError('No pudimos completar la solicitud. Inténtalo de nuevo.', response.status);
    }
    if (!isRegistro(body)) throw new ApiError('Recibimos una respuesta inesperada. Inténtalo de nuevo.');
    return body;
  }

  return {
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
