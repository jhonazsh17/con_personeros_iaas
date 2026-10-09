const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const RECORDS_TABLE = process.env.RECORDS_TABLE || 'personeros-iaas-records';

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

  const { dni, role } = body;

  if (typeof dni !== 'string' || !/^\d{8}$/.test(dni)) {
    return response(400, {
      error: 'Invalid DNI',
      message: 'DNI must be an 8-digit numeric string'
    });
  }

  if (typeof role !== 'string' || role.trim().length === 0) {
    return response(400, {
      error: 'Invalid role',
      message: 'Role must be a non-empty string'
    });
  }

  if (role !== 'personero') {
    return response(403, {
      error: 'Forbidden',
      message: 'Only personeros can check acta registration status'
    });
  }

  try {
    // Check if user has registered an acta
    const actaResult = await dynamodb.scan({
      TableName: RECORDS_TABLE,
      FilterExpression: 'dniUsuario = :dniUsuario',
      ExpressionAttributeValues: {
        ':dniUsuario': dni
      }
    }).promise();

    const hasRegisteredActa = actaResult.Items && actaResult.Items.length > 0;

    return response(200, {
      success: true,
      data: {
        hasRegisteredActa
      }
    });
  } catch (error) {
    console.error('Error checking acta registration:', error);
    return response(500, {
      error: 'Internal server error',
      message: 'Error checking acta registration status'
    });
  }
};
