'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const config = require('./config');

const LOCAL_ENDPOINTS = ['http://localemu:4566', 'http://127.0.0.1:4566'];

function createStore(client, tableName) {
  return {
    put: (item) => client.send(new PutCommand({
      TableName: tableName, Item: item, ConditionExpression: 'attribute_not_exists(id)',
    })),
    get: async (id) => {
      const result = await client.send(new GetCommand({
        TableName: tableName, Key: { id }, ConsistentRead: true,
      }));
      return result.Item;
    },
  };
}

let store;
let pendingStore;

async function buildStore() {
  const settings = await config.load();
  const endpoint = settings.DYNAMODB_ENDPOINT_URL;
  if (!LOCAL_ENDPOINTS.includes(endpoint)) {
    throw new Error('DYNAMODB_ENDPOINT_URL debe apuntar al laboratorio LocalEmu.');
  }
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({
    endpoint, region: process.env.AWS_REGION || 'us-east-1',
  }));
  return createStore(client, settings.TABLE_NAME);
}

async function localStore() {
  if (store) return store;
  if (!pendingStore) {
    pendingStore = buildStore()
      .then((created) => {
        store = created;
        return created;
      })
      .finally(() => {
        pendingStore = null;
      });
  }
  return pendingStore;
}

module.exports = {
  createStore,
  putRegistro: async (item) => (await localStore()).put(item),
  getRegistro: async (id) => (await localStore()).get(id),
};
