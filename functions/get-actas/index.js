const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const RECORDS_TABLE = process.env.RECORDS_TABLE || 'personeros-iaas-records';
const RECORD_ITEMS_TABLE = process.env.RECORD_ITEMS_TABLE || 'personeros-iaas-record-items';
const USERS_TABLE = process.env.USERS_TABLE || 'personeros-iaas-users';

exports.handler = async (event) => {
  console.log('Get Actas Event:', JSON.stringify(event, null, 2));
  
  try {
    // Scan all records
    const recordsResult = await dynamodb.scan({
      TableName: RECORDS_TABLE
    }).promise();
    
    const actas = [];
    
    for (const record of recordsResult.Items) {
      // Get details for each item in the acta
      const itemsDetails = [];

      if (record.items && Array.isArray(record.items)) {
        for (const item of record.items) {
          const itemResult = await dynamodb.get({
            TableName: RECORD_ITEMS_TABLE,
            Key: { id: item.id }
          }).promise();

          if (itemResult.Item) {
            itemsDetails.push({
              nombre: itemResult.Item.nombre,
              tipo: itemResult.Item.tipo,
              votos: itemResult.Item.votos,
              partido: itemResult.Item.partido || ''
            });
          }
        }
      }

      // Get user name
      let nombreUsuario = '';
      if (record.dniUsuario) {
        const userResult = await dynamodb.get({
          TableName: USERS_TABLE,
          Key: { dni: record.dniUsuario }
        }).promise();

        if (userResult.Item && userResult.Item.nombre) {
          nombreUsuario = userResult.Item.nombre;
        }
      }

      actas.push({
        id: record.id,
        numeroActa: record.numeroActa,
        lugar: record.lugar,
        items: itemsDetails,
        dniUsuario: record.dniUsuario,
        nombreUsuario,
        noVotantes: record.noVotantes || 0,
        fecha: record.fecha
      });
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          actas
        }
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
    
  } catch (error) {
    console.error('Error getting actas:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'Error retrieving actas'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
};
