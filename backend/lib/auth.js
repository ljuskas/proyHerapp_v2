'use strict';

const { readCookie } = require('./cookies');
const { COOKIE_NAME } = require('./session');
const { response } = require('./response');

function createAuth({ sessions }) {
  return {
    async current(event) {
      const token = readCookie(event, COOKIE_NAME);
      if (!token) return null;
      return sessions.find(token);
    },
    token(event) {
      return readCookie(event, COOKIE_NAME);
    },
  };
}

function unauthorized() {
  return response(401, { message: 'Inicia sesión para continuar.' });
}

function clientIp(event) {
  const headers = event?.headers || {};
  const forwarded = headers['X-Forwarded-For'] || headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return event?.requestContext?.identity?.sourceIp || null;
}

function userAgent(event) {
  const headers = event?.headers || {};
  const value = headers['User-Agent'] || headers['user-agent'];
  return typeof value === 'string' ? value.slice(0, 300) : null;
}

module.exports = { clientIp, createAuth, unauthorized, userAgent };
