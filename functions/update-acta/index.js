const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const RECORDS_TABLE = process.env.RECORDS_TABLE || 'personeros-iaas-records';
const RECORD_ITEMS_TABLE = process.env.RECORD_ITEMS_TABLE || 'personeros-iaas-record-items';
const USERS_TABLE = process.env.USERS_TABLE || 'personeros-iaas-users';

// Hardcoded partidos based on candidate names
const PARTIDOS = {
  'Marcos Enrique Ramos Bancayan': 'Alianza para el Progreso',
  'Rafael Grisolle Alvarez Calderon': 'Movimiento Independiente Fuerza Regional',
  'Manuel Orlando Cruz Correa': 'Partido Democrático Somos Perú',
  'Juan Manuel Chamaya Silva': 'Partido Político Perú Primero',
  'Victor Raul Hidalgo Lopez': 'Podemos Perú'
};

const response = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  }
});

exports.handler = async (event) => {
  console.log('Update Acta Event:', JSON.stringify(event, null, 2));

  try {
    const { actaId } = event.pathParameters || {};
    const body = JSON.parse(event.body);
    const { lugar, votos, noVotantes, dniUsuario } = body;

    // Validate required fields
    if (!actaId) {
      return response(400, {
        error: 'Missing required field',
        message: 'Field actaId is required'
      });
    }

    if (!lugar && !votos && noVotantes === undefined) {
      return response(400, {
        error: 'No fields to update',
        message: 'At least one field (lugar, votos, or noVotantes) must be provided'
      });
    }

    // Get user to check role
    if (!dniUsuario) {
      return response(400, {
        error: 'Missing required field',
        message: 'Field dniUsuario is required'
      });
    }

    const userResult = await dynamodb.get({
      TableName: USERS_TABLE,
      Key: { dni: dniUsuario }
    }).promise();

    if (!userResult.Item) {
      return response(404, {
        error: 'User not found',
        message: 'No user registered with this DNI'
      });
    }

    // Only admins can update actas
    if (userResult.Item.rol !== 'admin') {
      return response(403, {
        error: 'Forbidden',
        message: 'Only admins can update actas'
      });
    }

    // Get existing acta
    const existingActa = await dynamodb.get({
      TableName: RECORDS_TABLE,
      Key: { id: actaId }
    }).promise();

    if (!existingActa.Item) {
      return response(404, {
        error: 'Acta not found',
        message: 'No acta found with this ID'
      });
    }

    // Update record items if votos is provided
    if (votos) {
      // Delete existing items
      if (existingActa.Item.items && Array.isArray(existingActa.Item.items)) {
        for (const item of existingActa.Item.items) {
          await dynamodb.delete({
            TableName: RECORD_ITEMS_TABLE,
            Key: { id: item.id }
          }).promise();
        }
      }

      // Create new items
      const recordItems = [];

      // Save candidates
      if (votos.candidatos) {
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

      // Update the acta with new items
      await dynamodb.update({
        TableName: RECORDS_TABLE,
        Key: { id: actaId },
        UpdateExpression: 'SET #items = :items',
        ExpressionAttributeNames: {
          '#items': 'items'
        },
        ExpressionAttributeValues: {
          ':items': recordItems
        }
      }).promise();
    }

    // Update other fields
    const updateExpressions = [];
    const expressionAttributeValues = {};

    if (lugar) {
      updateExpressions.push('lugar = :lugar');
      expressionAttributeValues[':lugar'] = lugar;
    }

    if (noVotantes !== undefined && noVotantes !== null) {
      if (typeof noVotantes !== 'number' || !Number.isInteger(noVotantes) || noVotantes < 0) {
        return response(400, {
          error: 'Invalid noVotantes',
          message: 'noVotantes must be a non-negative integer'
        });
      }
      updateExpressions.push('noVotantes = :noVotantes');
      expressionAttributeValues[':noVotantes'] = noVotantes;
    }

    if (updateExpressions.length > 0) {
      await dynamodb.update({
        TableName: RECORDS_TABLE,
        Key: { id: actaId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues
      }).promise();
    }

    return response(200, {
      success: true,
      message: 'Acta updated successfully',
      data: {
        actaId
      }
    });

  } catch (error) {
    console.error('Error updating acta:', error);
    return response(500, {
      error: 'Internal server error',
      message: 'Error updating acta'
    });
  }
};
