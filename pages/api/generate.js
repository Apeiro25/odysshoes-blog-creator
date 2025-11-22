import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Load API key

export default async function handler(req, res) {
  console.log("HTTP Method:", req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { keywords } = req.body;

  if (!keywords || typeof keywords !== 'string') {
    return res.status(400).json({ error: 'Keywords are required and must be a string.' });
  }

  try {
    console.log("Sending request to OpenAI...");
    const prompt = `
Create a blog based on the following keywords: "${keywords}".
Your response should include:
1. Title
2. Meta Description
3. H1
4. Generate an intro paragraph for the blog (3-5 sentences long).
5. Main Content: Structure the content into H2 sections. Each H2 can include:
   - Paragraphs
   - Bullet points (prefix with '-')
   - Numbered lists (prefix with '1.', '2.', '3.')
6. FAQs (at least 3-5 questions with answers)
7. Generate an outro that includes:
   - A heading (H2) summarizing the conclusion.
   - A concise paragraph providing a conclusion for the blog.

Format the output as a JSON object with keys: 
{
  title: string,
  metaDescription: string,
  h1: string,
  intro: string,
  mainContent: [
    { heading: string, content: [{ type: "paragraph" | "bullet" | "numbered", text: string }] }
  ],
  faqs: [{ question: string, answer: string }],
  outro: { heading: string, paragraph: string }
}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4', // Use 'gpt-4' or 'text-davinci-003'
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3500,
    });

    console.log("OpenAI API Response:", response);
    const result = response.choices[0].message.content;
    console.log("OpenAI Response:", result);

    res.status(200).json({ blog: JSON.parse(result) });
  } catch (error) {
    console.error("OpenAI API Error:", error);
    res.status(500).json({ error: "Failed to generate blog content." });
  }
}