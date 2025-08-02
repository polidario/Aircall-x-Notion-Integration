const express = require('express');
const axios = require('axios');
const { Client } = require('@notionhq/client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const aircall_api_url = process.env.AIRCALL_API_URL;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World! The app is running!');
});

app.post('/webhook', async (req, res) => {
  // Uncomment this if you'd like to see the webhook response
  // console.log('Received webhook:', JSON.stringify(req.body, null, 2));
  
  const webhookPayload = req.body;
  const callData = webhookPayload.data;
  
  if (!callData || !callData.id || typeof callData.duration !== 'number') {
    console.error('Invalid webhook data received');
    return res.status(400).send('Invalid webhook data');
  }

  if (callData.duration > 60) {
    try {
      const insights = await getAIInsights(callData);
      await addToNotion(callData, insights);
      res.status(200).send('OK, now check Notion');
    } catch (error) {
      console.error('Failed to process webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    console.log('Call duration too short, skipping...');
    res.status(200).send('Call duration too short');
  }
});

async function getAIInsights(callData) {
  try {
    const response = await axios.get(
      `${aircall_api_url}/calls/${callData.id}/transcription`,
      {
        auth: {
          username: process.env.AIRCALL_API_ID,
          password: process.env.AIRCALL_API_TOKEN
        }
      }
    );

    const transcription = response.data.transcription;

    if (transcription.content.utterances && transcription.content.utterances.length > 0) {
      const utterances = transcription.content.utterances;
      let transcript = `Call Transcript (${utterances.length} exchanges):\n\n`;
      
      utterances.forEach((utterance, index) => {
        const speaker = utterance.speaker || `Speaker ${index % 2 + 1}`;
        const text = utterance.text || utterance.content || '[No text]';
        const timestamp = utterance.start_time ? `[${formatTime(utterance.start_time)}] ` : '';
        transcript += `${timestamp}${speaker}: ${text}\n`;
      });
      
      // Add metadata
      if (callData.comments && callData.comments.length > 0) {
        const comments = callData.comments.map(c => c.content).join('; ');
        transcript += `\nNotes: ${comments}`;
      }
      
      if (callData.tags && callData.tags.length > 0) {
        const tags = callData.tags.map(t => t.name).join(', ');
        transcript += `\nTags: ${tags}`;
      }
      
      return transcript;
    } else {
      return `Call Information:\n- Duration: ${callData.duration} seconds\n- Direction: ${callData.direction}\n- Phone: ${callData.raw_digits}\n- Language: ${transcription.content.language}\n\nTranscript: Processing... (ID: ${transcription.id})\nNote: AI transcription may take a few minutes to complete.`;
    }

  } catch (error) {
    console.warn('Transcription not available:', error.response?.status, error.message);
    
    return `Call Information:\n- Duration: ${callData.duration} seconds\n- Direction: ${callData.direction}\n- Phone: ${callData.raw_digits}\n- Status: Completed\n\nNote: AI transcription not available`;
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

async function addToNotion(callData, insights) {
  try {
    const response = await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_DATABASE_ID,
      },
      properties: {
        Title: {
          title: [{
            text: {
              content: `Call ${callData.id} - ${new Date(callData.started_at * 1000).toLocaleDateString()}`,
            },
          }],
        },
        'Call ID': {
          rich_text: [{
            text: {
              content: callData.id.toString(),
            },
          }],
        },
        Duration: {
          number: callData.duration,
        },
        Direction: {
          select: {
            name: callData.direction || 'Unknown',
          },
        },
        'Phone Number': {
          phone_number: callData.raw_digits || '',
        },
        'AI Summary': {
          rich_text: [{
            text: {
              content: insights,
            },
          }],
        },
        'Call Date': {
          date: {
            start: new Date(callData.started_at * 1000).toISOString().split('T')[0],
          },
        },
      },
    });
    
    return response;
  } catch (error) {
    console.error('Error adding to Notion:', error.message);
    throw new Error('Failed to add call summary to Notion');
  }
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

