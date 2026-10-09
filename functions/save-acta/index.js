const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const RECORD_ITEMS_TABLE = process.env.RECORD_ITEMS_TABLE || 'personeros-iaas-record-items';
const RECORDS_TABLE = process.env.RECORDS_TABLE || 'personeros-iaas-records';
const EMAIL_TOPIC_ARN = process.env.EMAIL_TOPIC_ARN;
const USERS_TABLE = process.env.USERS_TABLE || 'personeros-iaas-users';

// Hardcoded partidos based on candidate names
const PARTIDOS = {
  'Marcos Enrique Ramos Bancayan': 'Alianza para el Progreso',
  'Rafael Grisolle Alvarez Calderon': 'Movimiento Independiente Fuerza Regional',
  'Manuel Orlando Cruz Correa': 'Partido Democrático Somos Perú',
  'Juan Manuel Chamaya Silva': 'Partido Político Perú Primero',
  'Victor Raul Hidalgo Lopez': 'Podemos Perú'
};

exports.handler = async (event) => {
  console.log('Save Acta Event:', JSON.stringify(event, null, 2));
  
  try {
    const body = JSON.parse(event.body);
    const { numeroActa, lugar, votos, dniUsuario, noVotantes } = body;
    
    // Validate input
    if (!numeroActa || !lugar || !votos || !dniUsuario) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields',
          message: 'Fields numeroActa, lugar, votos, and dniUsuario are required'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    // Validate noVotantes if provided
    if (noVotantes !== undefined && noVotantes !== null) {
      if (typeof noVotantes !== 'number' || !Number.isInteger(noVotantes) || noVotantes < 0) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Invalid noVotantes',
            message: 'noVotantes must be a non-negative integer'
          }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
    }

    // Check if acta with same numeroActa already exists
    const existingActa = await dynamodb.scan({
      TableName: RECORDS_TABLE,
      FilterExpression: 'numeroActa = :numeroActa',
      ExpressionAttributeValues: {
        ':numeroActa': numeroActa
      }
    }).promise();

    if (existingActa.Items && existingActa.Items.length > 0) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: 'Acta already exists',
          message: `Acta number ${numeroActa} is already registered`
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    // Get user to check role
    const userResult = await dynamodb.get({
      TableName: USERS_TABLE,
      Key: { dni: dniUsuario }
    }).promise();

    if (!userResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'User not found',
          message: 'No user registered with this DNI'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    // Check if user is not admin and already registered an acta
    const isAdmin = userResult.Item.rol === 'admin';
    if (!isAdmin) {
      const userActas = await dynamodb.scan({
        TableName: RECORDS_TABLE,
        FilterExpression: 'dniUsuario = :dniUsuario',
        ExpressionAttributeValues: {
          ':dniUsuario': dniUsuario
        }
      }).promise();

      if (userActas.Items && userActas.Items.length > 0) {
        return {
          statusCode: 403,
          body: JSON.stringify({
            error: 'Acta already registered',
            message: 'You are not an admin and have already registered an acta. Contact an administrator.'
          }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
    }

    const actaId = `ACTA-${Date.now()}`;
    
    // Save record items (candidates + null votes + blank votes)
    const recordItems = [];
    
    // Save candidates
    for (const [candidateName, voteCount] of Object.entries(votos.candidatos)) {
      const itemId = `ITEM-${candidateName.replace(/\s+/g, '-')}-${Date.now()}`;
      await dynamodb.put({
        TableName: RECORD_ITEMS_TABLE,
        Item: {
          id: itemId,
          tipo: 'candidato',
          nombre: candidateName,
          votos: voteCount,
          partido: PARTIDOS[candidateName] || ''
        }
      }).promise();
      
      recordItems.push({
        id: itemId,
        votos: voteCount
      });
    }
    
    // Save null votes
    if (votos.nulos && votos.nulos > 0) {
      const nulosId = `ITEM-NULOS-${Date.now()}`;
      await dynamodb.put({
        TableName: RECORD_ITEMS_TABLE,
        Item: {
          id: nulosId,
          tipo: 'nulos',
          nombre: 'Votos Nulos',
          votos: votos.nulos
        }
      }).promise();
      
      recordItems.push({
        id: nulosId,
        votos: votos.nulos
      });
    }
    
    // Save blank votes
    if (votos.blancos && votos.blancos > 0) {
      const blancosId = `ITEM-BLANCOS-${Date.now()}`;
      await dynamodb.put({
        TableName: RECORD_ITEMS_TABLE,
        Item: {
          id: blancosId,
          tipo: 'blancos',
          nombre: 'Votos en Blanco',
          votos: votos.blancos
        }
      }).promise();
      
      recordItems.push({
        id: blancosId,
        votos: votos.blancos
      });
    }
    
    // Save the acta record
    await dynamodb.put({
      TableName: RECORDS_TABLE,
      Item: {
        id: actaId,
        numeroActa,
        lugar,
        items: recordItems,
        dniUsuario,
        noVotantes: noVotantes || 0,
        fecha: new Date().toISOString()
      }
    }).promise();
    
    // Publish event to SNS for email notification
    await sns.publish({
      TopicArn: EMAIL_TOPIC_ARN,
      Message: JSON.stringify({
        actaId,
        numeroActa,
        lugar,
        items: recordItems,
        dniUsuario,
        fecha: new Date().toISOString()
      }),
      MessageStructure: 'string'
    }).promise();
    
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: 'Acta saved successfully',
        data: {
          actaId,
          numeroActa,
          lugar
        }
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
    
  } catch (error) {
    console.error('Error saving acta:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
};
