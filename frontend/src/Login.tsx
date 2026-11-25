const MOTIVOS: Record<string, string> = {
  cancelado: 'Cancelaste el acceso con Google. Puedes intentarlo de nuevo.',
  parametros_invalidos: 'El enlace de acceso está incompleto. Inicia el acceso otra vez.',
  estado_invalido: 'El enlace de acceso caducó o ya se usó. Inicia el acceso otra vez.',
  google_rechazo: 'Google no confirmó el acceso. Inténtalo de nuevo.',
  error_interno: 'No pudimos completar el acceso. Inténtalo de nuevo en unos minutos.',
};

export default function Login({ loginUrl, motivo }: { loginUrl: string | undefined; motivo: string | null }) {
  const error = motivo ? MOTIVOS[motivo] || MOTIVOS.error_interno : null;
  return (
    <div className="login">
      <p className="eyebrow">ACCESO</p>
      <h1>Entra para ver tus registros.</h1>
      <p className="login-copy">
        Usamos tu cuenta de Google solo para identificarte. No publicamos nada en tu nombre.
      </p>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {loginUrl ? (
        <a className="button button-primary login-button" href={loginUrl}>Continuar con Google</a>
      ) : (
        <p className="feedback error" role="alert">
          El servicio de acceso no está disponible en este entorno.
        </p>
      )}
      <p className="login-note">
        El acceso requiere HTTPS. Si entras por la IP de la LAN sin cifrado, el navegador no guardará la sesión.
      </p>
    </div>
  );
}
