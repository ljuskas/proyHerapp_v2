import { useState } from 'react';
import type { Registro } from './api';

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Clipboard puede estar restringido; el fallback también permite usar HTTP en la LAN.
    }
  }
  const previousFocus = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    if (!document.execCommand('copy')) throw new Error('No se pudo copiar');
  } finally {
    textarea.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }
}

export default function RecordDetails({ registro }: { registro: Registro }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  async function copyId() {
    try {
      await copyText(registro.id);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <dl className="record-details">
      <div className="record-name"><dt>Nombre</dt><dd>{registro.nombre}</dd></div>
      <div className="id-block">
        <dt>ID del registro</dt>
        <dd><code>{registro.id}</code></dd>
        <button className="copy-button" type="button" onClick={copyId}>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="7" y="7" width="9" height="10" rx="2" /><path d="M12 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></svg>
          Copiar ID
        </button>
        <span className="copy-feedback" role="status">
          {copyState === 'copied' ? 'ID copiado.' : copyState === 'error' ? 'Selecciona el ID para copiarlo manualmente.' : ''}
        </span>
      </div>
      <div className="created-at"><dt>Fecha de creación</dt><dd><time dateTime={registro.createdAt}>{new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(registro.createdAt))}</time></dd></div>
    </dl>
  );
}
