/**
 * API Endpoint for scraping competitor blogs and generating unique content
 * POST /api/scrape-competitor
 * Body: { competitorUrl: string, keywords: string, author: string }
 */

import { OpenAI } from "openai";
import { scrapeCompetitorBlog, generateUniquenessPrompt } from "../../utils/scraperUtils.js";
import { generateSEOMetadata, insertInternalLinks, analyzeLinkDensity } from "../../utils/seoUtils.js";
import { buildSmartLinkingDatabase, smartInsertInternalLinks, analyzeLinkOpportunities } from "../../utils/smartLinking.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Function to generate image using Gemini API
async function generateImageWithGemini(keywords) {
  try {
    if (!GEMINI_API_KEY) {
      console.log("Gemini API key not configured, skipping image generation");
      return null;
    }

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
    
    // Return a URL with the generated description embedded
    const encodedKeywords = encodeURIComponent(keywords);
    return `https://source.unsplash.com/featured/?${encodedKeywords},blog,professional`;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
}

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { competitorUrls, keywords, author, shopifyToken: bodyToken, shopifyShop: bodyShop, shopifyBlogId: bodyBlogId } = req.body;
  
  // Prioritize request body credentials, fall back to environment variables
  const shopifyToken = bodyToken || process.env.SHOPIFY_API_TOKEN;
  const shopifyShop = bodyShop || process.env.SHOPIFY_SHOP;
  const blogId = bodyBlogId || process.env.SHOPIFY_BLOG_ID;

  // Validate inputs - keywords are now optional
  if (!competitorUrls || !Array.isArray(competitorUrls) || competitorUrls.length === 0 || !author) {
    return res.status(400).json({
      error: "competitorUrls (array) and author are required. Keywords are optional.",
    });
  }

  try {
    // Step 1: Scrape all competitor blogs
    const scrapedContents = [];
    const sources = [];

    for (const url of competitorUrls) {
      console.log("Scraping competitor blog:", url);
      const scrapedContent = await scrapeCompetitorBlog(url);

      if (scrapedContent.success) {
        scrapedContents.push(scrapedContent);
        sources.push({
          url: url,
          title: scrapedContent.title,
          wordCount: scrapedContent.wordCount,
          linksExtracted: scrapedContent.links.length,
        });
        console.log("Scraped content:", {
          title: scrapedContent.title,
          wordCount: scrapedContent.wordCount,
          linksFound: scrapedContent.links.length,
        });
      } else {
        console.warn("Failed to scrape:", url, scrapedContent.error);
      }
    }

    if (scrapedContents.length === 0) {
      return res.status(400).json({
        error: "Failed to scrape any of the competitor blogs",
      });
    }

    // Step 2: Auto-extract keywords if not provided
    let finalKeywords = keywords;
    
    if (!keywords || keywords.trim() === "") {
      console.log("Keywords not provided, auto-extracting from scraped content...");
      const combinedTitles = scrapedContents.map(c => c.title).join(", ");
      
      const keywordResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "user",
            content: `Extract 3-5 main keywords/topics from these blog titles. Return as comma-separated keywords only, nothing else.\n\nTitles: ${combinedTitles}`,
          },
        ],
        max_tokens: 100,
      });
      
      finalKeywords = keywordResponse.choices[0].message.content.trim();
      console.log("Auto-extracted keywords:", finalKeywords);
    }

    // Step 3: Summarize each blog's content to reduce token count
    console.log("Summarizing competitor content...");
    const summaries = [];
    
    for (const scrapedContent of scrapedContents) {
      const summaryResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "user",
            content: `Summarize the key points from this blog content in 3-4 bullet points. Be concise.\n\nContent: ${scrapedContent.body.substring(0, 2000)}`,
          },
        ],
        max_tokens: 300,
      });
      
      summaries.push({
        title: scrapedContent.title,
        summary: summaryResponse.choices[0].message.content,
      });
    }

    const combinedSummary = summaries.map(s => `Title: ${s.title}\n${s.summary}`).join("\n\n---\n\n");
    const uniquenessPrompt = generateUniquenessPrompt(combinedSummary, finalKeywords);

    console.log("Generating unique content from competitor research...");

    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "user",
          content: `${uniquenessPrompt}

Generate a comprehensive blog post and return ONLY valid JSON (no markdown, no extra text) with this exact structure:
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
}

Requirements:
- At least 4 sections in mainContent
- Each section must have 3-5 content items (mix of paragraphs, bullets, etc)
- At least 5 FAQs
- 2000+ words total
- Include keywords: "${finalKeywords}"
- Be completely original and unique`,
        },
      ],
      max_tokens: 4000,
    });

    const generatedBlog = normalizeBlogContent(extractJSON(openaiResponse.choices[0].message.content));

    // Step 3.5: Generate image for the blog
    console.log("Generating image for blog...");
    const blogImageUrl = await generateImageWithGemini(finalKeywords);
    console.log("Generated image URL:", blogImageUrl);

    // Step 4: Build blog HTML with internal links
    const sourceLinks = sources.map(s => `<a href="${s.url}" target="_blank">${s.title}</a>`).join(", ");
    let blogHtml =
      `<div class="blog-attribution">This content was inspired by research including: ${sourceLinks}</div>` +
      (blogImageUrl ? `<h2>Featured Visual</h2><img src="${blogImageUrl}" alt="AI Generated Visual for ${finalKeywords}" style="max-width: 100%; height: auto; margin: 20px 0;" />` : "") +
      `<p>${generatedBlog.intro}</p>` +
      generatedBlog.mainContent
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
      `<h2>${generatedBlog.outro.heading}</h2><p>${generatedBlog.outro.paragraph}</p>` +
      (generatedBlog.faqs && generatedBlog.faqs.length > 0
        ? `<h2>Frequently Asked Questions:</h2>` +
          generatedBlog.faqs
            .map(
              (faq) =>
                `<div><h3>${faq.question || ""}</h3><p>${faq.answer || ""}</p></div>`
            )
            .join("")
        : "");

    // Step 4: Apply SEO optimization with smart internal links (optional if Shopify not configured)
    console.log("Building smart linking database from Shopify store...");
    
    let optimizedHtml = blogHtml;
    let smartLinkDatabase = [];
    let linkAnalysis = { totalWords: 0, linkCount: 0, linkDensity: "0", recommendation: "N/A" };
    let linkOpportunities = { opportunities: [], total: 0 };
    
    if (shopifyShop && shopifyToken) {
      try {
        smartLinkDatabase = await buildSmartLinkingDatabase(shopifyShop, shopifyToken);
        console.log("Built linking database with", smartLinkDatabase.length, "links");
        
        optimizedHtml = smartInsertInternalLinks(blogHtml, smartLinkDatabase);
        linkOpportunities = analyzeLinkOpportunities(blogHtml, smartLinkDatabase);
        linkAnalysis = analyzeLinkDensity(optimizedHtml);
      } catch (shopifyError) {
        console.warn("Shopify integration skipped:", shopifyError.message);
        // Continue without Shopify optimization
      }
    } else {
      console.log("Shopify credentials not configured, skipping smart linking...");
    }
    const seoMetadata = generateSEOMetadata(generatedBlog.title, optimizedHtml, keywords);

    console.log("SEO metadata:", seoMetadata);
    console.log("Link analysis:", linkAnalysis);

    // Step 5: Publish to Shopify (optional if credentials not configured)
    let shopifyResult = null;
    
    if (shopifyShop && shopifyToken && blogId) {
      try {
        console.log("Publishing to Shopify...");

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
                title: generatedBlog.title,
                blog_id: blogId,
                meta_description: generatedBlog.metaDescription,
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
      console.log("Shopify credentials not configured, skipping publishing...");
    }

    res.status(200).json({
      success: true,
      sourceBlogs: sources,
      sourcesAnalyzed: scrapedContents.length,
      generatedBlog: {
        title: generatedBlog.title,
        metaDescription: generatedBlog.metaDescription,
      },
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
    res.status(500).json({
      error: "Failed to scrape and generate content",
      details: error.message,
    });
  }
}
