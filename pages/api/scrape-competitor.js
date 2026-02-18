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

  const { competitorUrls, keywords, author } = req.body;
  const shopifyToken = process.env.SHOPIFY_API_TOKEN;
  const shopifyShop = process.env.SHOPIFY_SHOP;
  const blogId = process.env.SHOPIFY_BLOG_ID;

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

Generate a comprehensive blog post that:
1. Covers the topic: "${finalKeywords}"
2. Is completely unique and original
3. Includes 2000+ words
4. Has clear H2 sections with useful information
5. Includes at least 5 FAQs
6. Links to relevant internal pages when appropriate
7. Format as JSON with keys: title, metaDescription, h1, intro, mainContent, faqs, outro`,
        },
      ],
      max_tokens: 4000,
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
