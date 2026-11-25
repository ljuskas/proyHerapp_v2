'use strict';

function readCookie(event, name) {
  const header = event?.headers?.Cookie || event?.headers?.cookie;
  if (typeof header !== 'string' || !header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function serializeCookie(name, value, { maxAge, secure = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  if (typeof maxAge === 'number') parts.push(`Max-Age=${Math.floor(maxAge)}`);
  return parts.join('; ');
}

function clearCookie(name, { secure = true } = {}) {
  return serializeCookie(name, '', { maxAge: 0, secure });
}

module.exports = { clearCookie, readCookie, serializeCookie };
