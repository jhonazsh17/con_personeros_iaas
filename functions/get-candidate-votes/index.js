const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const RECORD_ITEMS_TABLE = process.env.RECORD_ITEMS_TABLE || 'personeros-voting-serverless-record-items';

exports.handler = async (event) => {
  console.log('Get Candidate Votes Event:', JSON.stringify(event, null, 2));
  
  try {
    // Scan all record items
    const itemsResult = await dynamodb.scan({
      TableName: RECORD_ITEMS_TABLE
    }).promise();
    
    // Aggregate votes by candidate name
    const votesByCandidate = {};
    
    for (const item of itemsResult.Items) {
      if (item.tipo === 'candidato') {
        if (!votesByCandidate[item.nombre]) {
          votesByCandidate[item.nombre] = {
            nombre: item.nombre,
            partido: item.partido || '',
            totalVotos: 0
          };
        }
        votesByCandidate[item.nombre].totalVotos += item.votos;
      }
    }
    
    // Convert to array and sort by votes descending
    const candidates = Object.values(votesByCandidate).sort((a, b) => b.totalVotos - a.totalVotos);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ candidates }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
    
  } catch (error) {
    console.error('Error getting candidate votes:', error);
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
