import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in environment variables
});

const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
if (req.method !== 'POST') {
    console.log("[API Debug] Invalid request method:", req.method);
    console.log("Incoming Request Body:", req.body);
    console.log("OpenAI API Key Exists:", !!process.env.OPENAI_API_KEY);
    return res.status(405).json({ error: 'Method not allowed' });
}

const { prompt } = req.body;

console.log("[API Debug] Request Body:", req.body);
if (!prompt) {
    console.log("[API Debug] Missing 'prompt' in the request body.");
    return res.status(400).json({ error: 'Prompt is required' });
}

try {
    console.log("[API Debug] Sending prompt to OpenAI API:", prompt);
    const completion = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 1000,
    });

    console.log("[API Debug] OpenAI API Response:", completion.data);
    res.status(200).json({ blog: completion.data.choices[0].text });
} catch (error) {
    console.error("[API Debug] Error during OpenAI API call:", error);
    res.status(500).json({ error: 'Failed to generate blog' });
}
}