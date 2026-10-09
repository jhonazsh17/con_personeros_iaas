const AWS = require('aws-sdk');
const appconfig = new AWS.AppConfig();

const APP_CONFIG_APPLICATION_ID = process.env.APP_CONFIG_APPLICATION_ID;
const APP_CONFIG_ENVIRONMENT_ID = process.env.APP_CONFIG_ENVIRONMENT_ID;
const APP_CONFIG_CONFIGURATION_PROFILE_ID = process.env.APP_CONFIG_CONFIGURATION_PROFILE_ID;

exports.handler = async (event) => {
  console.log('Get Feature Flag Event:', JSON.stringify(event, null, 2));

  try {
    const { featureName } = event.pathParameters || {};

    if (!featureName) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Bad request',
          message: 'featureName is required in path'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    // Get configuration using traditional AppConfig API
    const configResponse = await appconfig.getConfiguration({
      Application: APP_CONFIG_APPLICATION_ID,
      Environment: APP_CONFIG_ENVIRONMENT_ID,
      Configuration: APP_CONFIG_CONFIGURATION_PROFILE_ID,
      ClientId: 'feature-flag-lambda'
    }).promise();

    if (!configResponse.Content) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Not found',
          message: 'Configuration not found'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    // Parse configuration content
    const configuration = JSON.parse(configResponse.Content.toString('utf-8'));

    // Get the specific feature flag
    const featureValue = configuration.features && configuration.features[featureName];

    if (featureValue === undefined) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Not found',
          message: `Feature flag '${featureName}' not found`
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          featureName,
          enabled: featureValue
        }
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };

  } catch (error) {
    console.error('Error getting feature flag:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'Error retrieving feature flag'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
};
