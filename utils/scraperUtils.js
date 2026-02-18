// Placeholder for content from competitor blogs
// In production, you'd use libraries like cheerio or puppeteer

/**
 * Scrape and extract content from a competitor blog URL
 * @param {string} url - The competitor blog URL to scrape
 * @returns {Promise<object>} - Extracted content with title, body, links, etc.
 */
export async function scrapeCompetitorBlog(url) {
  try {
    console.log("Scraping URL:", url);
    
    // Validate URL
    const urlObj = new URL(url);
    if (!url.startsWith("http")) {
      throw new Error("Invalid URL format");
    }

    // Fetch the blog post
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BlogCrawler/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract content using simple regex patterns (basic HTML parsing)
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/) || html.match(/<title[^>]*>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled";

    // Extract main content (paragraphs and headings)
    const contentMatches = html.match(/<p[^>]*>([^<]+(?:<[^>]+>[^<]*)*)<\/p>/g) || [];
    const bodyContent = contentMatches
      .slice(0, 10) // Get first 10 paragraphs
      .map((p) => p.replace(/<[^>]+>/g, "").trim())
      .filter((p) => p.length > 20)
      .join("\n\n");

    // Extract internal/external links
    const linkMatches = html.match(/<a\s+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi) || [];
    const links = [];
    linkMatches.forEach((match) => {
      const urlMatch = match.match(/href=["']([^"']+)["']/);
      const textMatch = match.match(/>([^<]+)<\/a>/);
      if (urlMatch && textMatch) {
        links.push({
          url: urlMatch[1],
          text: textMatch[1].trim(),
        });
      }
    });

    return {
      success: true,
      source: url,
      title,
      body: bodyContent,
      links: links.slice(0, 10), // Get first 10 links
      wordCount: bodyContent.split(/\s+/).length,
    };
  } catch (error) {
    console.error("Scraping error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate unique content based on scraped competitor content
 * @param {string} scrapedContent - Content from competitor blog
 * @param {string} keywords - Target keywords for the new blog
 * @returns {string} - Prompt for generating unique content
 */
export function generateUniquenessPrompt(scrapedContent, keywords) {
  return `You are a content writer. I have competitor content about "${keywords}". 

Competitor's content (for inspiration only):
"${scrapedContent}"

Create completely unique, original content about "${keywords}" that:
1. Does NOT copy the competitor's structure or exact wording
2. Provides different perspectives and insights
3. Includes unique examples and statistics
4. Targets the same keywords but from a fresh angle
5. Is written in your own authentic voice

Ensure the content is unique enough to pass plagiarism checks while covering the same topic comprehensively.`;
}
