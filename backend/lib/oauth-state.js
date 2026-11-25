'use strict';

const { timingSafeEqual } = require('node:crypto');
const { clearCookie, readCookie, serializeCookie } = require('./cookies');
const { hashToken } = require('./session');

const STATE_COOKIE_NAME = 'heraap_estado_oauth';
const STATE_TTL_MS = 10 * 60 * 1000;

function hashState(state) {
  return hashToken(state);
}

function readStateCookie(event) {
  return readCookie(event, STATE_COOKIE_NAME);
}

function sameStateHash(cookieHash, expectedHash) {
  if (typeof cookieHash !== 'string' || typeof expectedHash !== 'string') return false;
  const cookie = Buffer.from(cookieHash, 'utf8');
  const expected = Buffer.from(expectedHash, 'utf8');
  return cookie.length === expected.length && timingSafeEqual(cookie, expected);
}

function stateCookie(hash) {
  return serializeCookie(STATE_COOKIE_NAME, hash, { maxAge: STATE_TTL_MS / 1000 });
}

function clearStateCookie() {
  return clearCookie(STATE_COOKIE_NAME);
}

module.exports = {
  STATE_COOKIE_NAME,
  STATE_TTL_MS,
  clearStateCookie,
  hashState,
  readStateCookie,
  sameStateHash,
  stateCookie,
};
