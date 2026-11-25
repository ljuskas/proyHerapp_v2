import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, createApi } from './api';
import type { Registro } from './api';
import { readLastId, rememberId } from './storage';
import RecordDetails from './RecordDetails';

type RequestState = { kind: 'idle' | 'loading' } | { kind: 'success'; registro: Registro } | { kind: 'error'; message: string };
const api = createApi(import.meta.env.VITE_API_BASE_URL);
const message = (error: unknown) => error instanceof ApiError ? error.message : 'No pudimos completar la solicitud. Inténtalo de nuevo.';

export default function App() {
  const [nombre, setNombre] = useState('');
  const [nombreError, setNombreError] = useState('');
  const [createState, setCreateState] = useState<RequestState>({ kind: 'idle' });
  const [initialId] = useState(readLastId);
  const [queryId, setQueryId] = useState(initialId);
  const [lastSavedId, setLastSavedId] = useState(initialId);
  const [idError, setIdError] = useState('');
  const [queryState, setQueryState] = useState<RequestState>({ kind: 'idle' });
  const [storageWarning, setStorageWarning] = useState(false);
  const createRequest = useRef<AbortController | null>(null);
  const queryRequest = useRef<AbortController | null>(null);
  const queryInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    createRequest.current?.abort();
    queryRequest.current?.abort();
  }, []);

  function saveId(id: string) {
    const saved = rememberId(id);
    setStorageWarning(!saved);
    if (saved) setLastSavedId(id);
  }

  function changeQueryId(value: string) {
    queryRequest.current?.abort();
    queryRequest.current = null;
    setQueryId(value);
    setIdError('');
    setQueryState({ kind: 'idle' });
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createRequest.current) return;
    if (!nombre.trim()) {
      setNombreError('Escribe un nombre para el registro.');
      return;
    }
    setNombreError('');
    const controller = new AbortController();
    createRequest.current = controller;
    setCreateState({ kind: 'loading' });
    try {
      const registro = await api.createRegistro(nombre, controller.signal);
      if (controller.signal.aborted) return;
      setCreateState({ kind: 'success', registro });
      setNombre('');
      changeQueryId(registro.id);
      saveId(registro.id);
    } catch (error) {
      if (!controller.signal.aborted) setCreateState({ kind: 'error', message: message(error) });
    } finally {
      if (createRequest.current === controller) createRequest.current = null;
    }
  }

  async function query(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!queryId.trim()) {
      setIdError('Escribe el ID que quieres consultar.');
      return;
    }
    queryRequest.current?.abort();
    const controller = new AbortController();
    queryRequest.current = controller;
    setIdError('');
    setQueryState({ kind: 'loading' });
    try {
      const registro = await api.getRegistro(queryId, controller.signal);
      if (queryRequest.current !== controller || controller.signal.aborted) return;
      setQueryState({ kind: 'success', registro });
      saveId(registro.id);
    } catch (error) {
      if (queryRequest.current === controller && !controller.signal.aborted) {
        setQueryState({ kind: 'error', message: message(error) });
      }
    } finally {
      if (queryRequest.current === controller) queryRequest.current = null;
    }
  }

  return (
    <>
      <header className="site-header"><div className="header-inner">
        <a className="brand" href="./index.html" aria-label="Heraap, inicio"><span className="brand-mark" aria-hidden="true">h.</span><span>heraap</span></a>
        <span className="environment"><span aria-hidden="true" />Laboratorio local</span>
      </div></header>
      <main>
        <div className="intro"><p className="eyebrow">TU ESPACIO DE REGISTROS</p><h1>Crea. Guarda. Vuelve a encontrar.</h1><p>Un nombre es el comienzo. Su ID es la forma de volver.</p></div>
        <div className="workspace">
          <section className="panel" aria-labelledby="create-title" aria-busy={createState.kind === 'loading'}>
            <div className="panel-heading"><span className="step" aria-hidden="true">01</span><div><h2 id="create-title">Nuevo registro</h2><p>Guarda un nombre y recibe su ID.</p></div></div>
            <form onSubmit={create} noValidate>
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" value={nombre} onChange={(event) => { setNombre(event.target.value); setNombreError(''); }} placeholder="Ej. Mi primer registro" autoComplete="off" required disabled={createState.kind === 'loading'} aria-invalid={Boolean(nombreError)} aria-describedby={nombreError ? 'nombre-error' : 'nombre-help'} />
              {nombreError ? <p className="field-error" id="nombre-error" role="alert">{nombreError}</p> : <p className="field-help" id="nombre-help">Elige un nombre que puedas reconocer.</p>}
              <button className="button button-primary" type="submit" disabled={createState.kind === 'loading'}>
                {createState.kind === 'loading' ? <><span className="spinner" aria-hidden="true" />Creando registro…</> : <><span className="button-plus" aria-hidden="true">+</span>Crear registro</>}
              </button>
            </form>
            {createState.kind === 'error' && <p className="feedback error" role="alert">{createState.message}</p>}
            {createState.kind === 'success' && <div className="result">
              <p className="feedback success" role="status"><span aria-hidden="true">✓</span> Registro creado</p>
              <RecordDetails key={createState.registro.id} registro={createState.registro} />
              <button className="text-button" type="button" onClick={() => { if (createState.kind === 'success') changeQueryId(createState.registro.id); queryInput.current?.focus(); }}>Usar este ID para consultar <span aria-hidden="true">↗</span></button>
            </div>}
            {createState.kind === 'idle' && <div className="panel-note"><span aria-hidden="true">↳</span> Tu registro tendrá un ID único. Consérvalo para consultarlo después.</div>}
          </section>

          <section className="panel" aria-labelledby="query-title" aria-busy={queryState.kind === 'loading'}>
            <div className="panel-heading"><span className="step" aria-hidden="true">02</span><div><h2 id="query-title">Consultar registro</h2><p>Recupera la información con su ID.</p></div></div>
            <form onSubmit={query} noValidate>
              <label htmlFor="registro-id">ID del registro</label>
              <input id="registro-id" ref={queryInput} className="id-input" value={queryId} onChange={(event) => changeQueryId(event.target.value)} placeholder="Pega aquí el ID completo" autoComplete="off" spellCheck={false} required aria-invalid={Boolean(idError)} aria-describedby={idError ? 'id-error' : 'id-help'} />
              {idError ? <p className="field-error" id="id-error" role="alert">{idError}</p> : <p className="field-help" id="id-help">{queryId && queryId === lastSavedId ? 'Último ID guardado en este navegador.' : 'El ID se entrega al crear un registro.'}</p>}
              <button className="button button-secondary" type="submit" disabled={queryState.kind === 'loading'}>
                {queryState.kind === 'loading' ? <><span className="spinner" aria-hidden="true" />Buscando registro…</> : <><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>Buscar registro</>}
              </button>
            </form>
            {queryState.kind === 'error' && <p className="feedback error" role="alert">{queryState.message}</p>}
            {queryState.kind === 'success' && <div className="result"><p className="feedback success" role="status"><span aria-hidden="true">✓</span> Registro encontrado</p><RecordDetails key={queryState.registro.id} registro={queryState.registro} /></div>}
            {queryState.kind === 'idle' && <div className="empty-state"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect x="9" y="5" width="22" height="30" rx="4" /><path d="M15 14h10M15 20h10M15 26h6" /></svg><p>La información aparecerá aquí.</p><span>Solo necesitas el ID del registro.</span></div>}
          </section>
        </div>
        {storageWarning && <p className="storage-warning" role="status">Tu navegador no pudo recordar este ID. Cópialo para conservarlo.</p>}
        <footer className="workspace-footer"><span className="footer-mark" aria-hidden="true">↳</span> Conserva el ID para volver. Tus registros permanecen guardados aunque cierres la página.</footer>
      </main>
    </>
  );
}
