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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { competitorUrl, keywords, author } = req.body;
  const shopifyToken = process.env.SHOPIFY_API_TOKEN;
  const shopifyShop = process.env.SHOPIFY_SHOP;
  const blogId = process.env.SHOPIFY_BLOG_ID;

  // Validate inputs
  if (!competitorUrl || !keywords || !author) {
    return res.status(400).json({
      error: "competitorUrl, keywords, and author are required",
    });
  }

  try {
    console.log("Scraping competitor blog:", competitorUrl);

    // Step 1: Scrape competitor blog
    const scrapedContent = await scrapeCompetitorBlog(competitorUrl);

    if (!scrapedContent.success) {
      return res.status(400).json({
        error: "Failed to scrape competitor blog",
        details: scrapedContent.error,
      });
    }

    console.log("Scraped content:", {
      title: scrapedContent.title,
      wordCount: scrapedContent.wordCount,
      linksFound: scrapedContent.links.length,
    });

    // Step 2: Generate unique content based on scraped content
    const uniquenessPrompt = generateUniquenessPrompt(scrapedContent.body, keywords);

    console.log("Generating unique content from competitor research...");

    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: `${uniquenessPrompt}

Generate a comprehensive blog post that:
1. Covers the topic: "${keywords}"
2. Is completely unique and original
3. Includes 2000+ words
4. Has clear H2 sections with useful information
5. Includes at least 5 FAQs
6. Links to relevant internal pages when appropriate
7. Format as JSON with keys: title, metaDescription, h1, intro, mainContent, faqs, outro`,
        },
      ],
      max_tokens: 5000,
    });

    const generatedBlog = JSON.parse(openaiResponse.choices[0].message.content);

    // Step 3: Build blog HTML with internal links
    let blogHtml =
      `<div class="blog-attribution">This content was inspired by research including: <a href="${competitorUrl}" target="_blank">Read original source</a></div>` +
      `<p>${generatedBlog.intro}</p>` +
      generatedBlog.mainContent
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
      `<h2>${generatedBlog.outro.heading}</h2><p>${generatedBlog.outro.paragraph}</p>` +
      (generatedBlog.faqs && generatedBlog.faqs.length > 0
        ? `<h2>Frequently Asked Questions:</h2>` +
          generatedBlog.faqs
            .map(
              (faq) =>
                `<div><h3>${faq.question}</h3><p>${faq.answer}</p></div>`
            )
            .join("")
        : "");

    // Step 4: Apply SEO optimization with smart internal links
    console.log("Building smart linking database from Shopify store...");
    const smartLinkDatabase = await buildSmartLinkingDatabase(shopifyShop, shopifyToken);
    
    console.log("Optimizing for SEO with smart internal links...");
    const optimizedHtml = smartInsertInternalLinks(blogHtml, smartLinkDatabase);
    
    const linkOpportunities = analyzeLinkOpportunities(blogHtml, smartLinkDatabase);
    console.log("Link opportunities:", linkOpportunities);
    
    const linkAnalysis = analyzeLinkDensity(optimizedHtml);
    const seoMetadata = generateSEOMetadata(generatedBlog.title, optimizedHtml, keywords);

    console.log("SEO metadata:", seoMetadata);
    console.log("Link analysis:", linkAnalysis);

    // Step 5: Publish to Shopify
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
      return res.status(shopifyResponse.status).json({ error: errorDetails });
    }

    const shopifyResult = await shopifyResponse.json();

    res.status(200).json({
      success: true,
      scrapedSource: {
        url: competitorUrl,
        title: scrapedContent.title,
        wordCount: scrapedContent.wordCount,
        linksExtracted: scrapedContent.links.length,
      },
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
