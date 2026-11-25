'use strict';

const config = require('./config');
const { createAuth } = require('./auth');
const { createGoogleClient } = require('./google');
const { createRepositorio } = require('./repositorio');
const { createSessionStore } = require('./session');

let deps;

async function build() {
  const settings = await config.load();
  const db = await require('./db').localDatabase();
  const sessions = createSessionStore({ db });
  return {
    settings,
    db,
    sessions,
    repo: createRepositorio(db),
    auth: createAuth({ sessions }),
  };
}

function context() {
  if (!deps) {
    deps = build().catch((error) => {
      deps = null;
      throw error;
    });
  }
  return deps;
}

function googleClient(settings) {
  return createGoogleClient({
    clientId: settings.GOOGLE_CLIENT_ID,
    clientSecret: settings.GOOGLE_CLIENT_SECRET,
    redirectUri: settings.GOOGLE_REDIRECT_URI,
  });
}

module.exports = { context, googleClient };
