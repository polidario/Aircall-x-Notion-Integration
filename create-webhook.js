const axios = require('axios');
require('dotenv').config();

const aircall_api_url = process.env.AIRCALL_API_URL;

async function createWebhook() {
  try {
    const response = await axios.post(
      `${aircall_api_url}/webhooks`,
      {
        custom_name: 'Notion Integration Webhook',
        url: 'https://your-ngrok-url.ngrok-free.app/webhook', // Replace with your actual ngrok URL
        events: [
          'call.ended'
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(
            `${process.env.AIRCALL_API_ID}:${process.env.AIRCALL_API_TOKEN}`
          ).toString('base64')}`
        }
      }
    );

    console.log('Webhook created successfully!');
    // console.log('Webhook details:');
    // console.log(`- ID: ${response.data.webhook.webhook_id}`);
    // console.log(`- Name: ${response.data.webhook.custom_name || 'Webhook'}`);
    // console.log(`- URL: ${response.data.webhook.url}`);
    // console.log(`- Events: ${response.data.webhook.events.join(', ')}`);
    // console.log(`- Token: ${response.data.webhook.token}`);
    // console.log(`- Active: ${response.data.webhook.active}`);

  } catch (error) {
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(error.message);
    }
  }
}

createWebhook();
