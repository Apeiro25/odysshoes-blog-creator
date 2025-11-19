import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY, // Ensure the API key is loaded
});

const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  console.log("HTTP Method Received: ", req.method); // Debug the HTTP method

  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  // Validate the input
  if (!prompt || prompt.trim() === "") {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    // Fetch completion from OpenAI
    const completion = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: prompt,
      max_tokens: 1000,
    });

    res.status(200).json({ blog: completion.data.choices[0].text });
  } catch (error) {
    console.error("Error generating blog:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate blog' });
  }
}