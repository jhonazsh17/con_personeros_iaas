const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = process.env.USERS_TABLE || 'personeros-voting-serverless-users';

const response = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  }
});

exports.handler = async (event) => {
  let body;

  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return response(400, {
      error: 'Invalid request body',
      message: 'Body must be valid JSON'
    });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return response(400, {
      error: 'Invalid request body',
      message: 'Body must be an object'
    });
  }

  const { dni } = body;

  if (typeof dni !== 'string' || !/^\d{8}$/.test(dni)) {
    return response(400, {
      error: 'Invalid DNI',
      message: 'DNI must be an 8-digit numeric string'
    });
  }

  try {
    const result = await dynamodb.get({
      TableName: USERS_TABLE,
      Key: { dni }
    }).promise();

    if (!result.Item) {
      return response(404, {
        error: 'User not found',
        message: 'No user registered with this DNI'
      });
    }

    return response(200, {
      success: true,
      data: result.Item
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    return response(500, {
      error: 'Internal server error',
      message: 'Error retrieving user information'
    });
  }
};
