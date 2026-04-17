/**
 * Competitor Monitoring and Keyword Generation
 * Fetches competitor blog titles and extracts keywords for content generation
 */

import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Fetch blog titles from a competitor website
 * Supports common blog structures: /blogs, /news, /articles, /blog-posts
 */
export async function fetchCompetitorBlogTitles(competitorUrl, limit = 20) {
  try {
    console.log(`Fetching competitor blogs from: ${competitorUrl}`);

    // Normalize URL
    let url = competitorUrl;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    // Try different blog paths
    const blogPaths = ["/blogs", "/blogs.json", "/news", "/articles", "/blog-posts"];
    let titles = [];

    for (const path of blogPaths) {
      try {
        const fullUrl = url.replace(/\/$/, "") + path;
        console.log(`Trying: ${fullUrl}`);

        const response = await fetch(fullUrl, {
          timeout: 5000,
          headers: {
            "User-Agent": "Mozilla/5.0 (blog-scraper; +http://localhost:3000)",
          },
        });

        if (!response.ok) continue;

        const contentType = response.headers.get("content-type");

        if (contentType?.includes("application/json")) {
          // JSON API response (Shopify blogs)
          const data = await response.json();
          const blogTitles =
            data.articles?.map((a) => a.title) ||
            data.blogs?.map((b) => b.title) ||
            data.posts?.map((p) => p.title) ||
            [];

          titles = blogTitles.slice(0, limit);
          console.log(`Found ${titles.length} blogs at ${fullUrl}`);
          break;
        } else if (contentType?.includes("text/html")) {
          // HTML response - extract from meta tags or h1/h2
          const html = await response.text();

          // Extract titles from h1, h2, and title tags
          const titlePattern = /<(?:h1|h2|title)[^>]*>([^<]+)<\/(?:h1|h2|title)>/gi;
          const matches = html.match(titlePattern) || [];

          titles = matches
            .map((m) => m.replace(/<[^>]+>/g, "").trim())
            .filter((t) => t.length > 5 && t.length < 200)
            .slice(0, limit);

          if (titles.length > 5) {
            console.log(`Found ${titles.length} blogs at ${fullUrl}`);
            break;
          }
        }
      } catch (pathError) {
        console.log(`Path ${path} failed, trying next...`);
        continue;
      }
    }

    if (titles.length === 0) {
      throw new Error("Could not extract blog titles from competitor");
    }

    console.log(`✓ Extracted ${titles.length} competitor blog titles`);
    return titles;
  } catch (error) {
    console.error("Error fetching competitor blogs:", error);
    return [];
  }
}

/**
 * Extract keywords from blog titles using AI
 */
export async function extractKeywordsFromTitles(blogTitles) {
  try {
    console.log(`Extracting keywords from ${blogTitles.length} blog titles...`);

    const titlesText = blogTitles.join("\n- ");

    const prompt = `Extract main keywords and topics from these blog titles. Generate variations that would be good blog post topics for a custom shoe company.

Blog Titles:
- ${titlesText}

Return a JSON array with 10-15 keyword ideas based on these competitor blogs, adapted for the custom shoe niche:
["keyword 1", "keyword 2", ...]

Requirements:
- Each keyword should be a potential blog topic (2-4 words)
- Focus on shoes, customization, comfort, style, and trends
- Make them unique from the original titles but in similar topics
- Prioritize high-value, evergreen keywords`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content;

    // Parse JSON array
    let keywords = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        keywords = JSON.parse(jsonMatch[0]);
      } else {
        keywords = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse keywords:", content);
      throw new Error("Invalid keyword format from AI");
    }

    // Clean and validate
    keywords = keywords
      .filter((kw) => typeof kw === "string" && kw.trim().length > 0)
      .map((kw) => kw.trim())
      .slice(0, 15);

    console.log(`✓ Extracted ${keywords.length} keywords from competitor blogs`);
    return keywords;
  } catch (error) {
    console.error("Error extracting keywords:", error);
    return [];
  }
}

/**
 * Comprehensive competitor monitoring and keyword generation
 */
export async function monitorCompetitorAndGenerateKeywords(
  competitorUrls,
  usedKeywords = [],
  limit = 20
) {
  try {
    console.log(`Starting competitor monitoring for ${competitorUrls.length} competitors...`);

    const allTitles = [];

    // Fetch blogs from all competitors
    for (const url of competitorUrls) {
      try {
        const titles = await fetchCompetitorBlogTitles(url, 10);
        allTitles.push(...titles);
      } catch (error) {
        console.warn(`Failed to fetch from ${url}:`, error.message);
      }
    }

    if (allTitles.length === 0) {
      throw new Error("Could not fetch any competitor blogs");
    }

    console.log(`Total competitor blogs collected: ${allTitles.length}`);

    // Extract keywords from titles
    let keywords = await extractKeywordsFromTitles(allTitles);

    // Helper function to check for old years
    const hasOldYear = (keyword) => {
      const yearPattern = /(\b(?:19|20)\d{2}\b)|(\b[0-9]{1,2}['\-]?\d{2}\b)/g;
      const matches = keyword.match(yearPattern);
      if (!matches) return false;
      
      return matches.some(year => {
        let fullYear = year;
        if (year.length === 2 || (year.includes("'") && year.length === 3)) {
          const shortYear = parseInt(year.replace(/[''-]/g, ""));
          fullYear = shortYear > 50 ? "19" + shortYear : "20" + shortYear;
        }
        const numYear = parseInt(fullYear);
        return numYear <= 2025;
      });
    };

    // Filter out already used keywords, excluded terms, and old years
    const excludedTerms = ["near me", "services"];
    keywords = keywords.filter(
      (kw) => {
        // Check for used keywords
        if (usedKeywords.some(
          (used) =>
            used.toLowerCase().includes(kw.toLowerCase()) ||
            kw.toLowerCase().includes(used.toLowerCase())
        )) {
          return false;
        }
        
        // Check for old years
        if (hasOldYear(kw)) {
          console.log(`Skipping competitor keyword with old year: ${kw}`);
          return false;
        }
        
        // Check for excluded terms
        const kwLower = kw.toLowerCase();
        for (const term of excludedTerms) {
          if (kwLower.includes(term)) {
            console.log(`Skipping competitor keyword with excluded term "${term}": ${kw}`);
            return false;
          }
        }
        
        return true;
      }
    );

    console.log(`After filtering used keywords: ${keywords.length} keywords available`);

    return keywords.slice(0, limit);
  } catch (error) {
    console.error("Error in competitor monitoring:", error);
    throw error;
  }
}

/**
 * Schedule automated competitor monitoring
 * Runs periodically to update keyword list from competitor activity
 */
export function scheduleCompetitorMonitoring(
  competitorUrls,
  interval = 86400000
) {
  // Default: 24 hours
  console.log(`Scheduling competitor monitoring every ${interval / 1000 / 60 / 60} hours`);

  const job = setInterval(async () => {
    try {
      console.log("Running scheduled competitor monitoring...");
      const keywords = await monitorCompetitorAndGenerateKeywords(competitorUrls);
      console.log(`✓ Monitoring complete. Found ${keywords.length} keywords`);
      // Could store these in a monitored keywords table for the auto-generation system
    } catch (error) {
      console.error("Scheduled monitoring failed:", error);
    }
  }, interval);

  return job;
}

/**
 * Get competitor monitoring stats
 */
export async function getCompetitorMonitoringStats(competitorUrls) {
  try {
    console.log("Fetching competitor monitoring stats...");

    const stats = {
      checkedAt: new Date().toISOString(),
      competitors: [],
      totalBlogsParsed: 0,
      successCount: 0,
      failureCount: 0,
    };

    for (const url of competitorUrls) {
      try {
        const titles = await fetchCompetitorBlogTitles(url, 5);
        stats.competitors.push({
          url,
          status: "success",
          blogCount: titles.length,
        });
        stats.successCount++;
        stats.totalBlogsParsed += titles.length;
      } catch (error) {
        stats.competitors.push({
          url,
          status: "failed",
          error: error.message,
        });
        stats.failureCount++;
      }
    }

    return stats;
  } catch (error) {
    console.error("Error getting monitoring stats:", error);
    throw error;
  }
}
