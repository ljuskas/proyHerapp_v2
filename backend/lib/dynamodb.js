'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

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
function localStore() {
  if (!store) {
    const endpoint = process.env.DYNAMODB_ENDPOINT_URL;
    if (!['http://localemu:4566', 'http://127.0.0.1:4566'].includes(endpoint)) {
      throw new Error('DYNAMODB_ENDPOINT_URL debe apuntar al laboratorio LocalEmu.');
    }
    const tableName = process.env.TABLE_NAME;
    if (!tableName) throw new Error('Falta TABLE_NAME.');
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({
      endpoint, region: process.env.AWS_REGION || 'us-east-1',
    }));
    store = createStore(client, tableName);
  }
  return store;
}

module.exports = {
  createStore,
  putRegistro: (item) => localStore().put(item),
  getRegistro: (id) => localStore().get(id),
};
