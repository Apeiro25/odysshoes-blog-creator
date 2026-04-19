import { OpenAI } from "openai";
import { insertInternalLinks, generateSEOMetadata, generateLinkingStrategy, analyzeLinkDensity } from "../../utils/seoUtils.js";
import { buildSmartLinkingDatabase, smartInsertInternalLinks, analyzeLinkOpportunities } from "../../utils/smartLinking.js";
import { checkForDuplicates } from "../../utils/duplicateChecker.js";
import { fetchPublishedBlogs, findPhraseMatches, checkKeywordInPublishedBlogs } from "../../utils/odysshoesBlogFetcher.js";

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
      
      // Clean numbered list items by removing prefixes like "1.", "2.", etc.
      if (item && item.type === "numbered" && item.text) {
        // Remove leading numbers like "1. ", "2. ", "123. " etc.
        item.text = item.text.replace(/^\d+\.\s*/, "").trim();
      }
      
      // Validate table structure
      if (item && item.type === "table") {
        // Ensure headers and rows are arrays
        if (!Array.isArray(item.headers)) {
          item.headers = [];
        }
        if (!Array.isArray(item.rows)) {
          item.rows = [];
        }
        // Ensure each row is an array
        item.rows = item.rows.map(row => Array.isArray(row) ? row : []);
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

  // Check for duplicate keywords and outdated years
  console.log(`Checking for duplicates and year validation for: "${keywords}"`);
  const duplicateReport = await checkForDuplicates(keywords);
  console.log("Duplicate Report:", duplicateReport);

  if (duplicateReport.isDuplicate) {
    console.warn(`⛔ BLOCKING - ${duplicateReport.recommendation}`);
    duplicateReport.warnings.forEach(w => console.warn(w));
    return res.status(400).json({
      error: "Keyword blocked",
      reason: duplicateReport.recommendation,
      warnings: duplicateReport.warnings,
      duplicateReport,
    });
  }

  if (duplicateReport.recommendation.includes("CAUTION")) {
    console.warn(`⚠️ WARNING - ${duplicateReport.recommendation}`);
    duplicateReport.warnings.forEach(w => console.warn(w));
    // Log warning but continue (don't block)
  }

  // Fetch published blogs from odysshoes.com for linking opportunities
  console.log('🌐 Checking odysshoes.com/blogs/news for published blogs...');
  const publishedBlogs = await fetchPublishedBlogs();
  
  // Check if keyword already exists in published blogs
  const keywordDuplicateCheck = checkKeywordInPublishedBlogs(keywords, publishedBlogs);
  if (keywordDuplicateCheck.isDuplicate) {
    console.warn(`⛔ ODYSSHOES DUPLICATE - Keyword already used in published blogs`);
    console.warn(`Found ${keywordDuplicateCheck.matchCount} similar blog(s)`);
    keywordDuplicateCheck.matches.forEach(m => {
      console.warn(`  - ${m.blog.title} (${m.matchType})`);
    });
    return res.status(400).json({
      error: "Keyword already published",
      reason: `This keyword or similar content already exists on odysshoes.com/blogs/news`,
      publishedBlogMatches: keywordDuplicateCheck.matches.map(m => ({
        title: m.blog.title,
        url: m.blog.url,
        matchType: m.matchType,
      })),
      duplicateReport,
    });
  }

  const hasShopifyConfig = shopifyToken && shopifyShop && blogId;
  if (!hasShopifyConfig) {
    console.warn("Shopify credentials not fully configured. Blog will be generated without Shopify integration.");
  }

  try {
    let generatedImageURL = null;
    
    // Image generation disabled due to Gemini API quota limits
    // if (hasShopifyConfig) {
    //   console.log("Generating and uploading AI image to Shopify...");
    //   generatedImageURL = await generateAndUploadImage(keywords, shopifyShop, shopifyToken);
    // } else {
    //   console.log("Shopify not configured, skipping image upload...");
    // }
    
    console.log("Sending request to OpenAI...");
    const prompt = `
You are an expert SEO copywriter. Create a comprehensive, 2000-word SEO-optimized blog post based on the keyword: "${keywords}".

INSTRUCTIONS:
1. Research and create content that matches the depth and quality of top Google search results for this keyword
2. Write in clear, professional language suitable for e-commerce customers
3. Focus on providing value and answering user questions
4. Make content engaging and scannable with proper formatting
5. Use tables when comparing features, specs, or providing structured data

BLOG STRUCTURE - Return ONLY valid JSON (no markdown, no explanations):

{
  "title": "SEO-friendly title (avoid 'ultimate guide' clichés)",
  "metaDescription": "Compelling meta description under 160 characters for search results",
  "h1": "Main heading for the blog post",
  "intro": "2-3 paragraph introduction covering: what the topic is, why it matters, what the reader will learn",
  
  "mainContent": [
    {
      "heading": "H2 section heading that matches one aspect of the keyword",
      "content": [
        {"type": "paragraph", "text": "Detailed paragraph text explaining this section"},
        {"type": "bullet", "text": "Key point or benefit"},
        {"type": "bullet", "text": "Another key point"},
        {"type": "numbered", "text": "First step or item in a list"},
        {"type": "numbered", "text": "Second step or item"},
        {"type": "table", "headers": ["Column 1", "Column 2", "Column 3"], "rows": [["Data 1", "Data 2", "Data 3"], ["Data 4", "Data 5", "Data 6"]]},
        {"type": "paragraph", "text": "Concluding paragraph for this section"}
      ]
    },
    {
      "heading": "Another H2 section with different angle",
      "content": [
        {"type": "paragraph", "text": "Content for this section..."}
      ]
    }
  ],
  
  "faqs": [
    {"question": "Common question related to the keyword?", "answer": "Detailed answer..."},
    {"question": "Another related question?", "answer": "Another detailed answer..."}
  ],
  
  "outro": {
    "heading": "Conclusion or Final Thoughts",
    "paragraph": "2-3 sentences summarizing key takeaways and encouraging reader action"
  }
}

CONTENT GUIDELINES:
- Main content MUST be 800-1500+ words
- Include at least 4-6 H2 sections covering different angles of the topic
- Use a mix of paragraphs, bullet points, numbered lists, and tables for readability
- Include at least 1-2 comparison tables when appropriate (compare features, specs, sizes, prices, etc.)
- Include at least 5 FAQ questions with detailed answers
- DO NOT add number prefixes to numbered list items (just provide text, e.g., {"type": "numbered", "text": "First step here"}, NOT "1. First step")
- DO NOT promote commercial products
- Focus on educational and informative content
- If relevant to shoes or customization, relate the topic back to personalized/custom solutions
- Make content valuable for both casual readers and customers interested in custom shoes

TABLE FORMAT RULES:
- Use tables for comparisons, specifications, or structured data
- "headers": array of column titles
- "rows": array of arrays, each inner array is a row of data
- Keep tables simple and readable (3-6 columns, 3-8 rows max)
- Include descriptive headers

Return ONLY the JSON object - no additional text, markdown, or explanations.`;
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
    });

    let result = normalizeBlogContent(extractJSON(response.choices[0].message.content));

    // Validation function to check if blog meets minimum requirements
    const validateBlogContent = (blog) => {
      // Count H2 sections
      const h2Count = blog.mainContent ? blog.mainContent.length : 0;
      
      // Count words in main content
      let totalWords = 0;
      if (blog.mainContent && Array.isArray(blog.mainContent)) {
        blog.mainContent.forEach((section) => {
          if (section.content && Array.isArray(section.content)) {
            section.content.forEach((item) => {
              if (item && item.text) {
                totalWords += item.text.split(/\s+/).length;
              }
            });
          }
        });
      }
      
      // Add intro words
      if (blog.intro) {
        totalWords += blog.intro.split(/\s+/).length;
      }
      
      // Add outro words
      if (blog.outro && blog.outro.paragraph) {
        totalWords += blog.outro.paragraph.split(/\s+/).length;
      }
      
      // Add FAQ words
      if (blog.faqs && Array.isArray(blog.faqs)) {
        blog.faqs.forEach((faq) => {
          if (faq.question) totalWords += faq.question.split(/\s+/).length;
          if (faq.answer) totalWords += faq.answer.split(/\s+/).length;
        });
      }
      
      const meetsWordCount = totalWords >= 800;
      const meetsH2Count = h2Count >= 4;
      
      return {
        valid: meetsWordCount && meetsH2Count,
        totalWords,
        h2Count,
        meetsWordCount,
        meetsH2Count
      };
    };

    // Validate and regenerate if needed
    let validation = validateBlogContent(result);
    let regenerationAttempts = 0;
    const maxRegenerationAttempts = 2;

    while (!validation.valid && regenerationAttempts < maxRegenerationAttempts) {
      regenerationAttempts++;
      console.log(`Content validation failed. Regenerating (attempt ${regenerationAttempts}/${maxRegenerationAttempts})...`);
      console.log(`Current: ${validation.totalWords} words, ${validation.h2Count} H2 sections`);
      console.log(`Required: 800+ words, 4+ H2 sections`);
      
      // Create stricter regeneration prompt
      const regenerationPrompt = `
You are an expert SEO copywriter. Create a COMPREHENSIVE, 1200-1500 word SEO-optimized blog post based on the keyword: "${keywords}".

CRITICAL REQUIREMENTS - YOU MUST MEET THESE:
1. EXACTLY 6-8 H2 SECTIONS (each section must be substantial with 100-200 words)
2. TOTAL CONTENT MUST BE 1200-1500 WORDS (excluding FAQ and conclusion)
3. EACH SECTION MUST HAVE:
   - At least one paragraph (100-150 words)
   - At least 2-3 bullets OR a numbered list OR a table
   - Rich, detailed content

INSTRUCTIONS:
1. Research and create content that matches the depth and quality of top Google search results for this keyword
2. Write in clear, professional language suitable for e-commerce customers
3. Focus on providing value, detailed explanations, and answering user questions
4. Make content engaging and scannable with proper formatting
5. Use tables when comparing features, specs, or providing structured data
6. Add more sections and deeper content coverage than the previous attempt

BLOG STRUCTURE - Return ONLY valid JSON (no markdown, no explanations):

{
  "title": "SEO-friendly title (avoid 'ultimate guide' clichés)",
  "metaDescription": "Compelling meta description under 160 characters for search results",
  "h1": "Main heading for the blog post",
  "intro": "3-4 paragraph introduction covering: what the topic is, why it matters, what the reader will learn",
  
  "mainContent": [
    {
      "heading": "H2 section 1 heading",
      "content": [
        {"type": "paragraph", "text": "Detailed 150+ word paragraph text"},
        {"type": "bullet", "text": "Key point 1"},
        {"type": "bullet", "text": "Key point 2"},
        {"type": "bullet", "text": "Key point 3"}
      ]
    },
    {
      "heading": "H2 section 2 heading",
      "content": [
        {"type": "paragraph", "text": "Another detailed paragraph..."},
        {"type": "numbered", "text": "Step 1"},
        {"type": "numbered", "text": "Step 2"},
        {"type": "numbered", "text": "Step 3"}
      ]
    }
  ],
  
  "faqs": [
    {"question": "Question 1?", "answer": "Detailed answer..."},
    {"question": "Question 2?", "answer": "Another detailed answer..."}
  ],
  
  "outro": {
    "heading": "Conclusion",
    "paragraph": "Concluding paragraph"
  }
}

CONTENT GUIDELINES:
- MUST have 6-8 H2 sections (this is non-negotiable)
- MUST total 1200-1500 words in main content
- Each section must be substantial (150-300 words minimum)
- Use a mix of paragraphs, bullet points, numbered lists, and tables for readability
- Include at least 1-2 comparison tables when appropriate
- Include at least 5 FAQ questions with detailed answers
- DO NOT add number prefixes to numbered list items
- DO NOT promote commercial products
- Focus on educational and informative content
- If relevant to shoes or customization, relate to personalized/custom solutions

Return ONLY the JSON object - no additional text, markdown, or explanations.`;

      const regenerationResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [{ role: "user", content: regenerationPrompt }],
        max_tokens: 4000,
      });

      result = normalizeBlogContent(extractJSON(regenerationResponse.choices[0].message.content));
      validation = validateBlogContent(result);
    }

    if (!validation.valid) {
      console.warn(`Blog content validation failed after ${regenerationAttempts} regeneration attempts`);
      console.warn(`Final content: ${validation.totalWords} words, ${validation.h2Count} H2 sections`);
      console.warn(`Required: 800+ words, 4+ H2 sections`);
    } else {
      console.log(`✓ Blog content validation passed: ${validation.totalWords} words, ${validation.h2Count} H2 sections`);
    }

    console.log("Publishing blog post to Shopify...");

    // Build complete blog HTML (without schemas - will add after optimization)
    let blogHtml = 
      `<p>${result.intro}</p>` +
      (generatedImageURL ? `<h2>Featured Visual</h2><img src="${generatedImageURL}" alt="AI Generated Visual for ${keywords}" style="max-width: 100%; height: auto; margin: 20px 0;" />` : "") +
      result.mainContent
        .map((section) => {
          // Helper function to render table
          const renderTable = (table) => {
            if (!table.headers || !table.rows) return "";
            const headerHtml = table.headers.map(h => `<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${h || ""}</th>`).join("");
            const rowsHtml = table.rows.map(row => {
              const cellsHtml = (Array.isArray(row) ? row : []).map(cell => `<td style="border: 1px solid #ddd; padding: 8px;">${cell || ""}</td>`).join("");
              return `<tr>${cellsHtml}</tr>`;
            }).join("");
            return `<table style="border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid #ddd;"><thead style="background-color: #f5f5f5;"><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
          };

          // Collect numbered items
          let numberedItems = Array.isArray(section.content) ? section.content
            .filter((c) => c && c.type === "numbered")
            .map((c) => `<li>${c.text || ""}</li>`)
            .join("") : "";

          // Render other content (paragraphs, bullets, tables)
          const otherContent = Array.isArray(section.content) ? section.content
            .map((c) => {
              if (!c) return "";
              if (c.type === "paragraph") {
                return `<p>${c.text || ""}</p>`;
              } else if (c.type === "bullet") {
                return `<ul><li>${c.text || ""}</li></ul>`;
              } else if (c.type === "table") {
                return renderTable(c);
              }
              return "";
            })
            .join("") : "";

          return (
            `<h2>${section.heading || "Section"}</h2>` +
            otherContent +
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
    let linkedOdysshoeBlogs = [];
    
    // Check for phrase matches with published odysshoes.com blogs
    console.log('🔗 Checking for phrase matches with published blogs...');
    linkedOdysshoeBlogs = findPhraseMatches(result.title + ' ' + result.intro + ' ' + result.mainContent.map(s => s.heading + ' ' + s.content.map(c => c.text).join(' ')).join(' '), publishedBlogs);
    
    if (linkedOdysshoeBlogs.length > 0) {
      console.log(`✓ Found ${linkedOdysshoeBlogs.length} phrase match(es) with existing blogs:`);
      linkedOdysshoeBlogs.forEach((match, idx) => {
        console.log(`  ${idx + 1}. "${match.title}" (${match.matchType})`);
      });
      
      // Inject links to matched blogs into content
      console.log('Injecting internal links to matched blogs...');
      linkedOdysshoeBlogs.forEach((linkedBlog) => {
        // Only add link if not already in content
        if (!optimizedHtml.includes(linkedBlog.url)) {
          // Find a good place to insert the link - after title mention or in first section
          const titleMention = new RegExp(linkedBlog.title.split(' ')[0], 'gi');
          optimizedHtml = optimizedHtml.replace(titleMention, (match) => {
            // Only create link once per blog
            if (!optimizedHtml.includes(`<a href="${linkedBlog.url}"`)) {
              return `<a href="${linkedBlog.url}" title="${linkedBlog.title}">${match}</a>`;
            }
            return match;
          });
        }
      });
    } else {
      console.log('ℹ️ No phrase matches found with existing odysshoes.com blogs');
    }
    
    // Insert all relevant blog article links based on keywords
    console.log("Inserting relevant blog article links...");
    optimizedHtml = insertInternalLinks(optimizedHtml, keyword);
    
    if (hasShopifyConfig) {
      try {
        console.log("Building smart linking database from Shopify store...");
        smartLinkDatabase = await buildSmartLinkingDatabase(shopifyShop, shopifyToken);
        
        console.log("Adding product/collection links with intelligent placement...");
        optimizedHtml = smartInsertInternalLinks(optimizedHtml, smartLinkDatabase, keyword);
        
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
      contentValidation: validation,
      duplicateCheck: duplicateReport,
      odysshoesIntegration: {
        publishedBlogsCount: publishedBlogs.length,
        linkedBlogs: linkedOdysshoeBlogs.map(b => ({
          title: b.title,
          url: b.url,
          slug: b.slug,
          matchType: b.matchType,
        })),
        linkedBlogsCount: linkedOdysshoeBlogs.length,
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
    res.status(500).json({ error: "Failed to generate or publish blog content." });
  }
}