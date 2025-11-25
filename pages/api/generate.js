import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Load API key

export default async function handler(req, res) {
  console.log("HTTP Method:", req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { keywords, shopifyToken, shopifyShop } = req.body;

  if (!keywords || typeof keywords !== 'string') {
    return res.status(400).json({ error: 'Keywords are required and must be a string.' });
  }

  if (!shopifyToken || !shopifyShop) {
    return res.status(400).json({ error: 'Shopify token and Shopify shop are required.' });
  }

  try {
    console.log("Sending request to OpenAI...");
    const prompt = `
Create a blog based on the following keywords: "${keywords}".
Your response should include:
1. Title
2. Meta Description
3. H1
4. Generate an intro paragraph for the blog (5 sentences long).
5. Main Content (Strictly 2000 words): Structure the content into H2 sections. Each H2 can include:
   - Paragraphs
   - Bullet points (prefix with '-')
   - Numbered lists (prefix with '1.', '2.', '3.')
6. FAQs (at least 5 questions with answers)
7. Generate an outro that includes:
   - A heading (H2) summarizing the conclusion.
   - A concise paragraph providing a conclusion for the blog (5 sentences long).

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
}`;
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5000,
    });

    const result = JSON.parse(response.choices[0].message.content);

    console.log("Publishing blog to Shopify...");

    const shopifyResponse = await fetch(`https://${shopifyShop}/admin/api/2023-01/blogs.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyToken,
      },
      body: JSON.stringify({
        blog: {
          title: result.title,
          body_html:
            `<h1>${result.h1}</h1><p>${result.intro}</p>` +
            result.mainContent
              .map(
                (section) =>
                  `<h2>${section.heading}</h2>` +
                  section.content
                    .map((c) =>
                      c.type === 'paragraph'
                        ? `<p>${c.text}</p>`
                        : c.type === 'bullet'
                        ? `<ul><li>${c.text}</li></ul>`
                        : `<ol><li>${c.text}</li></ol>`
                    )
                    .join('')
              )
              .join('') +
            `<h2>${result.outro.heading}</h2><p>${result.outro.paragraph}</p>`,
        },
      }),
    });

    if (!shopifyResponse.ok) {
      const errorDetails = await shopifyResponse.json();
      return res.status(shopifyResponse.status).json({ error: errorDetails });
    }

    const shopifyResult = await shopifyResponse.json();

    res.status(200).json({ success: true, blog: result, shopifyResponse: shopifyResult });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to generate or publish blog content." });
  }
}