import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Load API key

export default async function handler(req, res) {
  console.log("HTTP Method:", req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required and must be a string' });
  }

  try {
    console.log("Sending request to OpenAI...");
    const response = await openai.chat.completions.create({
      model: 'gpt-4', // Use 'gpt-4' or 'text-davinci-003'
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    });

    console.log("OpenAI API Response:", response);
    res.status(200).json({ blog: response.choices[0].message.content });
  } catch (error) {
    console.error("OpenAI API Error:", error);
    res.status(500).json({ error: 'Failed to generate blog' });
  }
}