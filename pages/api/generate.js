import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in environment variables
});

const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  console.log("Received HTTP Method: ", req.method); // Log the method received

  if (req.method !== 'POST') {
    console.log("Method Not Allowed");
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const completion = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt,
      max_tokens: 1000,
    });
    res.status(200).json({ blog: completion.data.choices[0].text });
  } catch (error) {
    console.error("Error with OpenAI API: ", error);
    res.status(500).json({ error: 'Failed to generate blog' });
  }
}