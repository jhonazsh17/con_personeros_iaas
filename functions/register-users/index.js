const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = process.env.USERS_TABLE || 'personeros-iaas-users';
const ALLOWED_ROLES = new Set(['admin', 'coordinador', 'personero']);

const response = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  }
});

exports.handler = async (event) => {
  let users;

  try {
    users = JSON.parse(event.body);
  } catch (error) {
    return response(400, { error: 'Body must be valid JSON' });
  }

  if (!Array.isArray(users) || users.length === 0) {
    return response(400, { error: 'Body must be a non-empty array of users' });
  }

  const validationErrors = [];

  users.forEach((user, index) => {
    if (!user || typeof user !== 'object' || Array.isArray(user)) {
      validationErrors.push({ index, error: 'Each element must be an object' });
      return;
    }

    const unexpectedFields = Object.keys(user).filter((field) => !['dni', 'rol', 'nombre'].includes(field));
    if (unexpectedFields.length > 0) {
      validationErrors.push({ index, error: 'Only fields dni, rol and nombre are allowed' });
    }

    if (typeof user.dni !== 'string' || !/^\d{8}$/.test(user.dni)) {
      validationErrors.push({ index, field: 'dni', error: 'DNI must be an 8-digit numeric string' });
    }

    if (typeof user.nombre !== 'string' || user.nombre.trim().length === 0) {
      validationErrors.push({ index, field: 'nombre', error: 'Nombre must be a non-empty string' });
    }

    if (!ALLOWED_ROLES.has(user.rol)) {
      validationErrors.push({ index, field: 'rol', error: 'Rol must be admin, coordinador or personero' });
    }
  });

  if (validationErrors.length > 0) {
    return response(400, { error: 'Users contain invalid data', details: validationErrors });
  }

  try {
    const results = await Promise.all(users.map(async ({ dni, rol, nombre }) => {
      try {
        await dynamodb.put({
          TableName: USERS_TABLE,
          Item: { dni, rol, nombre },
          ConditionExpression: 'attribute_not_exists(dni)'
        }).promise();

        return { dni, status: 'created' };
      } catch (error) {
        if (error.code === 'ConditionalCheckFailedException') {
          return { dni, status: 'already_exists' };
        }
        throw error;
      }
    }));

    const created = results.filter(({ status }) => status === 'created');
    const duplicates = results.filter(({ status }) => status === 'already_exists');
    const statusCode = duplicates.length === 0 ? 201 : created.length === 0 ? 409 : 207;

    return response(statusCode, { created, duplicates });
  } catch (error) {
    console.error('Error registering users:', error);
    return response(500, { error: 'Internal error registering users' });
  }
};