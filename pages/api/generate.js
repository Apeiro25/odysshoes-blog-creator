import { OpenAI } from "openai";
import { insertInternalLinks, generateSEOMetadata, generateLinkingStrategy, analyzeLinkDensity } from "../../utils/seoUtils.js";
import { buildSmartLinkingDatabase, smartInsertInternalLinks, analyzeLinkOpportunities } from "../../utils/smartLinking.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Load API keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Function to generate image using Gemini API
async function generateImageWithGemini(keywords) {
  try {
    // First, use Gemini to generate an image description
    const descriptionResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Create a professional, detailed image description for a blog post about: "${keywords}". The description should be suitable for generating a high-quality image. Be specific about style, mood, and visual elements. Keep it under 100 words.`
              }
            ]
          }
        ]
      })
    });

    if (!descriptionResponse.ok) {
      console.error("Gemini API error:", await descriptionResponse.text());
      return null;
    }

    const data = await descriptionResponse.json();
    const imageDescription = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    console.log("Generated image description:", imageDescription);
    
    // Return a data URI with the generated description embedded
    // This can be used with services like Unsplash API or other image providers
    // For now, we'll return a placeholder that includes the topic
    const encodedKeywords = encodeURIComponent(keywords);
    return `https://source.unsplash.com/featured/?${encodedKeywords},blog,professional`;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
}

// Function to download image as buffer
async function downloadImage(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer;
  } catch (error) {
    console.error("Error downloading image:", error);
    return null;
  }
}

// Function to upload image to Shopify using Files API
async function uploadImageToShopify(imageBuffer, filename, shopifyShop, shopifyToken) {
  try {
    if (!imageBuffer) {
      console.error("No image buffer provided");
      return null;
    }

    // Convert buffer to base64
    const base64Image = imageBuffer.toString("base64");

    // Use Shopify GraphQL API to upload file
    const graphqlQuery = `
      mutation createFile($files: [FileInput!]!) {
        fileCreate(files: $files, resource: FILE) {
          files {
            id
            fileStatus
            preview {
              image {
                url
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      files: [
        {
          filename: filename,
          fileBlob: base64Image,
          mimeType: "image/jpeg"
        }
      ]
    };

    const response = await fetch(`https://${shopifyShop}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": shopifyToken,
      },
      body: JSON.stringify({ 
        query: graphqlQuery,
        variables: variables
      }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      return null;
    }

    if (result.data?.fileCreate?.userErrors?.length > 0) {
      console.error("File creation errors:", result.data.fileCreate.userErrors);
      return null;
    }

    const fileUrl = result.data?.fileCreate?.files?.[0]?.preview?.image?.url;
    if (fileUrl) {
      console.log("Image uploaded to Shopify:", fileUrl);
      return fileUrl;
    }

    console.warn("No file URL returned from Shopify");
    return null;
  } catch (error) {
    console.error("Error uploading image to Shopify:", error);
    return null;
  }
}

// Function to generate image and upload to Shopify
async function generateAndUploadImage(keywords, shopifyShop, shopifyToken) {
  try {
    // Step 1: Generate/fetch image URL
    const imageUrl = await generateImageWithGemini(keywords);
    if (!imageUrl) {
      console.error("Failed to generate image");
      return null;
    }

    // Step 2: Download the image
    const imageBuffer = await downloadImage(imageUrl);
    if (!imageBuffer) {
      console.error("Failed to download image");
      return null;
    }

    // Step 3: Create filename
    const sanitizedKeywords = keywords.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const filename = `blog-${sanitizedKeywords}-${Date.now()}.jpg`;

    // Step 4: Upload to Shopify
    const shopifyImageUrl = await uploadImageToShopify(imageBuffer, filename, shopifyShop, shopifyToken);
    
    return shopifyImageUrl;
  } catch (error) {
    console.error("Error in generateAndUploadImage:", error);
    return null;
  }
}


export default async function handler(req, res) {
  console.log("HTTP Method:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Load Shopify credentials from environment variables
  const shopifyToken = process.env.SHOPIFY_API_TOKEN;
  const shopifyShop = process.env.SHOPIFY_SHOP;
  const blogId = process.env.SHOPIFY_BLOG_ID;

  // Extract parameters from request body
  const { keyword, author } = req.body;
  const keywords = keyword;

  // Debugging: Log the incoming request parameters
  console.log("Request Body Received:", {
    keywords,
    author,
  });

  // Validate required parameters
  if (!keywords || typeof keywords !== "string") {
    return res
      .status(400)
      .json({ error: "Keywords are required and must be a string." });
  }

  if (!author || typeof author !== "string") {
    return res
      .status(400)
      .json({ error: "Author name is required and must be a string." });
  }

  if (!shopifyToken || !shopifyShop || !blogId) {
    console.error("Missing Shopify environment variables:", {
      shopifyToken: !!shopifyToken,
      shopifyShop: !!shopifyShop,
      blogId: !!blogId,
    });
    return res.status(400).json({
      error: "Shopify configuration missing. Please set SHOPIFY_API_TOKEN, SHOPIFY_SHOP, and SHOPIFY_BLOG_ID in environment variables.",
    });
  }

  try {
    console.log("Generating and uploading AI image to Shopify...");
    const generatedImageURL = await generateAndUploadImage(keywords, shopifyShop, shopifyToken);
    
    console.log("Sending request to OpenAI...");
    const prompt = `
Create a 2000 wods SEO-optimized blog based on the following keywords: "${keywords}".
When given the keywords, you should research the top 5 search results on Google and create a comprehensive blog post that covers the topic in depth and average word count of the top 5 results.
Your response should include:
1. Title (avoid using "ultimate guide" or similar phrases)
2. Meta Description
3. Generate an intro paragraph for the blog (5 sentences long).
4. Main Content (Strictly 2000 words): Structure the content into H2 sections. Each H2 can include:
   - Paragraphs
   - Bullet points
   - Numbered lists (prefix with '1.', '2.', '3.' 4.' etc.)
   - Tables (if necessary)
5. FAQs (at least 5 questions with answers)
6. Generate an outro that includes:
   - A heading (H2) summarizing the conclusion.
   - A concise paragraph providing a conclusion for the blog (5 sentences long).
7. Optional: If relevant to the website odysshoes.com, which is a customizable shoe store, include a section on how the topic relates to customizable shoes.
8. Do not include mentioning of brands names or their products.
9. always put this link https://odysshoes.com/collections/custom-shoes to a word "customize shoes" "want to custom your shoes" or any similar to "custom shoes", strictly once only and in the last part of the blog.
10.always put this link https://odysshoes.com/collections/custom-basketball-shoes to words like "customize basketball shoes", "customize your own basketball shoes" or any similar wordings strictly once only and in the last part of the blog.
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
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 5000,
    });

    const result = JSON.parse(response.choices[0].message.content);

    console.log("Publishing blog post to Shopify...");

    // Build complete blog HTML
    let blogHtml = 
      `<p>${result.intro}</p>` +
      (generatedImageURL ? `<h2>Featured Visual</h2><img src="${generatedImageURL}" alt="AI Generated Visual for ${keywords}" style="max-width: 100%; height: auto; margin: 20px 0;" />` : "") +
      result.mainContent
        .map((section) => {
          let numberedItems = section.content
            .filter((c) => c.type === "numbered")
            .map((c) => `<li>${c.text}</li>`)
            .join("");

          return (
            `<h2>${section.heading}</h2>` +
            section.content
              .map((c) =>
                c.type === "paragraph"
                  ? `<p>${c.text}</p>`
                  : c.type === "bullet"
                  ? `<ul><li>${c.text}</li></ul>`
                  : ""
              )
              .join("") +
            (numberedItems ? `<ol>${numberedItems}</ol>` : "")
          );
        })
        .join("") +
      
      `<h2>${result.outro.heading}</h2><p>${result.outro.paragraph}</p>`+

      // Adding FAQs after the outro
      (result.faqs && result.faqs.length > 0
        ? `<h2>Frequently Asked Questions:</h2>` +
          result.faqs
            .map(
              (faq) =>
                `<div>` +
                `<h3>${faq.question}</h3>` +
                `<p>${faq.answer}</p>` +
                `</div>`
            )
            .join("") +
          `<script type="application/ld+json">` +
          JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": result.faqs.map((faq) => ({
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer,
              },
            })),
          }) +
          `</script>`
        : "");

    // Apply SEO optimization with smart internal links
    console.log("Building smart linking database from Shopify store...");
    const smartLinkDatabase = await buildSmartLinkingDatabase(shopifyShop, shopifyToken);
    
    console.log("Optimizing for SEO and inserting smart internal links...");
    const optimizedHtml = smartInsertInternalLinks(blogHtml, smartLinkDatabase);
    
    // Analyze link opportunities that were found but not used
    const linkOpportunities = analyzeLinkOpportunities(blogHtml, smartLinkDatabase);
    console.log("Link opportunities:", linkOpportunities);
    
    // Analyze link density for reporting
    const linkAnalysis = analyzeLinkDensity(optimizedHtml);
    console.log("Link density analysis:", linkAnalysis);
    
    // Generate SEO metadata
    const seoMetadata = generateSEOMetadata(result.title, optimizedHtml, keywords);
    console.log("SEO metadata:", seoMetadata);

    // Publish to Shopify with optimized content
    const shopifyResponse = await fetch(
      `https://${shopifyShop}/admin/api/2023-01/articles.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": shopifyToken,
        },
        body: JSON.stringify({
          article: {
            title: result.title,
            blog_id: blogId,
            meta_description: result.metaDescription,
            author: author,
            body_html: optimizedHtml,
          },
        }),
      }
    );

    if (!shopifyResponse.ok) {
      const errorDetails = await shopifyResponse.json(); // Log detailed error info
      console.error("Shopify API Error:", errorDetails);
      console.log("Meta Description Sent:", result.metaDescription);
      return res.status(shopifyResponse.status).json({ error: errorDetails });
    }

    const shopifyResult = await shopifyResponse.json();

    res.status(200).json({
      success: true,
      blog: result,
      seo: {
        metadata: seoMetadata,
        linkAnalysis: linkAnalysis,
        smartLinking: {
          linksInserted: linkAnalysis.linkCount,
          opportunitiesFound: linkOpportunities.total,
          databaseSize: smartLinkDatabase.length,
        },
      },
      shopifyResponse: shopifyResult,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to generate or publish blog content." });
  }
}