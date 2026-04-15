import { OpenAI } from "openai";
import { insertInternalLinks, generateSEOMetadata, generateLinkingStrategy, analyzeLinkDensity } from "../../utils/seoUtils.js";
import { buildSmartLinkingDatabase, smartInsertInternalLinks, analyzeLinkOpportunities } from "../../utils/smartLinking.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Load API keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Helper function to strip markdown code blocks from JSON string
function extractJSON(response) {
  try {
    // Try direct parse first
    return JSON.parse(response);
  } catch (e) {
    // Try removing markdown code blocks
    let cleaned = response.trim();
    
    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Try parsing again
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      // Try to find JSON object in the string
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e3) {
          console.error("Failed to parse JSON:", jsonMatch[0].substring(0, 200));
          throw new Error(`Invalid JSON response from AI: ${e3.message}`);
        }
      }
      throw e2;
    }
  }
}

// Helper function to normalize blog content structure
function normalizeBlogContent(blog) {
  if (!blog || typeof blog !== 'object') {
    blog = {};
  }

  // Ensure basic fields exist
  blog.title = blog.title || "Untitled Article";
  blog.metaDescription = blog.metaDescription || blog.title;
  blog.intro = blog.intro || "";
  
  // Ensure mainContent is valid array
  if (!blog.mainContent || !Array.isArray(blog.mainContent)) {
    blog.mainContent = [];
  }

  blog.mainContent = blog.mainContent.map((section, idx) => {
    if (!section.heading) section.heading = `Section ${idx + 1}`;
    
    // Ensure content is an array of objects
    if (!Array.isArray(section.content)) {
      if (typeof section.content === "string") {
        section.content = [{ type: "paragraph", text: section.content }];
      } else {
        section.content = [];
      }
    }

    // Validate each content item
    section.content = section.content.map(item => {
      if (typeof item === "string") {
        return { type: "paragraph", text: item };
      }
      return item || { type: "paragraph", text: "" };
    });

    return section;
  });

  // Ensure outro exists with valid structure
  if (!blog.outro || typeof blog.outro !== 'object') {
    blog.outro = { heading: "Conclusion", paragraph: "Thank you for reading this guide." };
  } else {
    blog.outro.heading = blog.outro.heading || "Conclusion";
    blog.outro.paragraph = blog.outro.paragraph || "Thank you for reading this guide.";
  }

  // Ensure faqs is a valid array
  if (!Array.isArray(blog.faqs)) {
    blog.faqs = [];
  }

  blog.faqs = blog.faqs.map(faq => ({
    question: faq.question || "Question?",
    answer: faq.answer || "Answer not available."
  }));

  return blog;
}

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

  // Load Shopify credentials from environment variables or request body (optional)
  const envShopifyToken = process.env.SHOPIFY_API_TOKEN;
  const envShopifyShop = process.env.SHOPIFY_SHOP;
  const envShopifyBlogId = process.env.SHOPIFY_BLOG_ID;

  // Extract parameters from request body
  const { keyword, author, shopifyToken: bodyToken, shopifyShop: bodyShop, shopifyBlogId: bodyBlogId } = req.body;
  
  // Prioritize request body credentials, fall back to environment variables
  const shopifyToken = bodyToken || envShopifyToken;
  const shopifyShop = bodyShop || envShopifyShop;
  const blogId = bodyBlogId || envShopifyBlogId;
  
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

  const hasShopifyConfig = shopifyToken && shopifyShop && blogId;
  if (!hasShopifyConfig) {
    console.warn("Shopify credentials not fully configured. Blog will be generated without Shopify integration.");
  }

  try {
    let generatedImageURL = null;
    
    if (hasShopifyConfig) {
      console.log("Generating and uploading AI image to Shopify...");
      generatedImageURL = await generateAndUploadImage(keywords, shopifyShop, shopifyToken);
    } else {
      console.log("Shopify not configured, skipping image upload...");
    }
    
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

Return ONLY valid JSON (no markdown, no extra text) with this exact structure:
{
  "title": "Catchy blog title",
  "metaDescription": "SEO-friendly meta description under 160 characters",
  "h1": "H1 heading",
  "intro": "2-3 sentence introduction",
  "mainContent": [
    {
      "heading": "Section Title",
      "content": [
        {"type": "paragraph", "text": "paragraph text"},
        {"type": "bullet", "text": "bullet point"},
        {"type": "numbered", "text": "numbered point"}
      ]
    }
  ],
  "faqs": [
    {"question": "FAQ question?", "answer": "FAQ answer"}
  ],
  "outro": {
    "heading": "Conclusion",
    "paragraph": "Concluding paragraph"
  }
}`;
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
    });

    const result = normalizeBlogContent(extractJSON(response.choices[0].message.content));

    console.log("Publishing blog post to Shopify...");

    // Build complete blog HTML (without schemas - will add after optimization)
    let blogHtml = 
      `<p>${result.intro}</p>` +
      (generatedImageURL ? `<h2>Featured Visual</h2><img src="${generatedImageURL}" alt="AI Generated Visual for ${keywords}" style="max-width: 100%; height: auto; margin: 20px 0;" />` : "") +
      result.mainContent
        .map((section) => {
          let numberedItems = Array.isArray(section.content) ? section.content
            .filter((c) => c && c.type === "numbered")
            .map((c) => `<li>${c.text || ""}</li>`)
            .join("") : "";

          return (
            `<h2>${section.heading || "Section"}</h2>` +
            (Array.isArray(section.content) ? section.content
              .map((c) =>
                c && c.type === "paragraph"
                  ? `<p>${c.text || ""}</p>`
                  : c && c.type === "bullet"
                  ? `<ul><li>${c.text || ""}</li></ul>`
                  : ""
              )
              .join("") : "") +
            (numberedItems ? `<ol>${numberedItems}</ol>` : "")
          );
        })
        .join("") +
      
      `<h2>${result.outro.heading}</h2><p>${result.outro.paragraph}</p>`+

      // Adding FAQs after the outro
      (result.faqs && Array.isArray(result.faqs) && result.faqs.length > 0
        ? `<h2>Frequently Asked Questions:</h2>` +
          result.faqs
            .map(
              (faq) =>
                `<div>` +
                `<h3>${faq.question || ""}</h3>` +
                `<p>${faq.answer || ""}</p>` +
                `</div>`
            )
            .join("")
        : "");

    // Apply SEO optimization with smart internal links
    console.log("Applying SEO optimization...");
    let optimizedHtml = blogHtml;
    let smartLinkDatabase = [];
    let linkOpportunities = { opportunities: [], total: 0 };
    let linkAnalysis = { totalWords: 0, linkCount: 0, linkDensity: "0", recommendation: "N/A" };
    
    // Insert all relevant blog article links based on keywords
    console.log("Inserting relevant blog article links...");
    optimizedHtml = insertInternalLinks(optimizedHtml, keyword);
    
    if (hasShopifyConfig) {
      try {
        console.log("Building smart linking database from Shopify store...");
        smartLinkDatabase = await buildSmartLinkingDatabase(shopifyShop, shopifyToken);
        
        console.log("Adding product/collection links...");
        optimizedHtml = smartInsertInternalLinks(optimizedHtml, smartLinkDatabase);
        
        // Analyze link opportunities that were found but not used
        linkOpportunities = analyzeLinkOpportunities(optimizedHtml, smartLinkDatabase);
        console.log("Link opportunities:", linkOpportunities);
        
        // Analyze link density for reporting
        linkAnalysis = analyzeLinkDensity(optimizedHtml);
        console.log("Link density analysis:", linkAnalysis);
      } catch (shopifyError) {
        console.warn("Shopify smart linking skipped:", shopifyError.message);
        // Continue without smart linking
      }
    } else {
      console.log("Shopify not configured, skipping smart linking...");
    }
    
    // Generate SEO metadata
    const seoMetadata = generateSEOMetadata(result.title, optimizedHtml, keywords);
    console.log("SEO metadata:", seoMetadata);

    // Add structured data schemas before publishing
    console.log("Adding structured data schemas (FAQ and BlogPosting)...");
    
    // FAQ Schema
    const faqSchema = result.faqs && Array.isArray(result.faqs) && result.faqs.length > 0
      ? `<script type="application/ld+json">` +
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
      : "";
    
    // BlogPosting Schema
    const blogPostingSchema = 
      `<script type="application/ld+json">` +
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": result.title,
        "description": result.metaDescription,
        "author": {
          "@type": "Person",
          "name": author
        },
        "datePublished": new Date().toISOString().split('T')[0],
        "dateModified": new Date().toISOString().split('T')[0],
        ...(generatedImageURL && {
          "image": {
            "@type": "ImageObject",
            "url": generatedImageURL
          }
        })
      }) +
      `</script>`;
    
    // Append schemas to optimized HTML
    optimizedHtml = optimizedHtml + faqSchema + blogPostingSchema;

    // Publish to Shopify with optimized content (optional)
    let shopifyResult = null;
    
    if (hasShopifyConfig) {
      try {
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
          const errorDetails = await shopifyResponse.json();
          console.error("Shopify API Error:", errorDetails);
          console.warn("Blog generated successfully but Shopify publishing failed");
        } else {
          shopifyResult = await shopifyResponse.json();
          console.log("Published to Shopify successfully");
        }
      } catch (shopifyError) {
        console.warn("Shopify publishing failed:", shopifyError.message);
        console.log("Blog generated successfully but Shopify publishing skipped");
      }
    } else {
      console.log("Shopify not configured, skipping publishing...");
    }

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