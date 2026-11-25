'use strict';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function requestId(event, context) {
  return context?.awsRequestId || event?.requestContext?.requestId || 'local';
}

function log(logger, level, fields) {
  logger[level](JSON.stringify({ level, ...fields }));
}

module.exports = { response, requestId, log };
