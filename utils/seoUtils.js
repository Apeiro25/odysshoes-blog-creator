/**
 * SEO Utilities for keyword research, link optimization, and internal linking
 */

/**
 * Generate blog article links for internal linking
 * Maps multiple keywords to relevant blog articles on odysshoes.com/blogs/news
 * @param {string} mainKeyword - The main blog keyword
 * @returns {Array} - Array of blog articles that can be linked to
 */
export function generateRelatedKeywords(mainKeyword) {
  // Blog article database - Multiple links to relevant published blogs
  const blogArticleDatabase = [
    // Custom Shoes
    {
      keywords: ["custom shoes", "customize shoes", "shoe customization", "bespoke shoes", "personalized shoes"],
      anchor: "custom shoes",
      url: "/collections/custom-shoes",
    },
    // Custom Basketball Shoes
    {
      keywords: ["custom basketball shoes", "customize basketball shoes", "custom hoops shoes", "personalized basketball shoes"],
      anchor: "custom basketball shoes",
      url: "/collections/custom-basketball-shoes",
    },
    // Shoe Cleaning
    {
      keywords: ["shoe cleaner", "clean shoes", "shoe cleaning", "homemade shoe cleaner", "diy shoe cleaner"],
      anchor: "homemade shoe cleaner guide",
      url: "/blogs/news/clean-like-a-pro-homemade-shoe-cleaner-diy-guide",
    },
    // Shoe Sizing & Fitting
    {
      keywords: ["shoe size", "measure shoe size", "shoe fitting", "shoe sizing", "proper fit"],
      anchor: "measure your shoe size",
      url: "/blogs/news/how-to-measure-your-shoe-size",
    },
    // Non-Slip Shoes
    {
      keywords: ["non-slip shoes", "non-slip", "slip resistant", "prevent slipping", "grip shoes"],
      anchor: "make shoes non-slip",
      url: "/blogs/news/how-to-make-shoes-non-slip-14-effective-methods",
    },
  ];

  return blogArticleDatabase;
}

/**
 * Find all link opportunities in content based on keywords
 * @param {string} content - The blog post content (HTML)
 * @param {Array} articles - Blog articles database from generateRelatedKeywords
 * @returns {Array} - Array of link opportunities found in the content
 */
function findLinkOpportunities(content, articles) {
  const opportunities = [];
  const contentLower = content.toLowerCase();
  const alreadyLinked = new Set();

  articles.forEach((article) => {
    article.keywords.forEach((keyword) => {
      // Find all occurrences of this keyword
      const regex = new RegExp(`\\b${keyword}\\b`, "gi");
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        const position = match.index;
        
        // Check if already linked near this position
        const nearbyLink = content.substring(Math.max(0, position - 50), position + 50).match(/<a\s+href=/);
        if (!nearbyLink) {
          opportunities.push({
            keyword,
            position,
            article,
            match: match[0],
          });
        }
      }
    });
  });

  return opportunities;
}

/**
 * Analyze content and insert internal links to all relevant published blogs
 * @param {string} content - The blog post content (HTML)
 * @param {string} mainKeyword - The main blog keyword
 * @returns {string} - Content with internal links inserted
 */
export function insertInternalLinks(content, mainKeyword) {
  try {
    const articles = generateRelatedKeywords(mainKeyword);
    let modifiedContent = content;
    let totalLinksInserted = 0;
    const linkedKeywords = new Set(); // Track which keywords we've already linked

    // For each article in the database, find and link matching keywords (only once)
    articles.forEach((article) => {
      article.keywords.forEach((keyword) => {
        // Skip if we've already linked this keyword
        if (linkedKeywords.has(keyword.toLowerCase())) {
          return;
        }

        // Create regex to find the keyword with word boundaries
        const regex = new RegExp(`\\b${keyword}\\b(?![^<]*>)(?![^<]*</a>)`, "i");
        
        // Replace ONLY the first occurrence
        if (regex.test(modifiedContent)) {
          modifiedContent = modifiedContent.replace(regex, (match) => {
            linkedKeywords.add(keyword.toLowerCase());
            totalLinksInserted++;
            return `<a href="${article.url}" title="${article.anchor}">${match}</a>`;
          });
        }
      });
    });

    console.log(`Inserted ${totalLinksInserted} internal blog links (1 per keyword)`);
    return modifiedContent;
  } catch (error) {
    console.error("Error inserting internal links:", error);
    return content;
  }
}

/**
 * Analyze link density and ensure optimal linking
 * @param {string} content - The blog post HTML content
 * @returns {object} - Link density analysis
 */
export function analyzeLinkDensity(content) {
  const totalWords = content.split(/\s+/).length;
  const linkMatches = content.match(/<a\s+href=/g) || [];
  const linkCount = linkMatches.length;
  const linkDensity = totalWords > 0 ? (linkCount / totalWords) * 100 : 0;

  return {
    totalWords,
    linkCount,
    linkDensity: linkDensity.toFixed(2),
    recommendation: linkDensity < 1 ? "Add more internal links" : linkDensity > 3 ? "Too many links - consider removing some" : "Optimal link density",
  };
}

/**
 * Generate SEO-optimized metadata
 * @param {string} title - Blog post title
 * @param {string} content - Blog post content
 * @param {string} keyword - Main keyword
 * @returns {object} - SEO metadata
 */
export function generateSEOMetadata(title, content, keyword) {
  // Generate meta description (150-160 chars)
  let metaDescription = content.substring(0, 150);
  if (metaDescription.length < 150) {
    metaDescription = content.substring(0, 160).trim() + "...";
  }

  // Check keyword presence
  const keywordInTitle = title.toLowerCase().includes(keyword.toLowerCase());
  const keywordInContent = content.toLowerCase().includes(keyword.toLowerCase());
  const keywordDensity = ((content.toLowerCase().match(new RegExp(keyword.toLowerCase(), "g")) || []).length / content.split(/\s+/).length) * 100;

  return {
    title,
    metaDescription,
    keyword,
    keywordInTitle,
    keywordInContent,
    keywordDensity: keywordDensity.toFixed(2),
    wordCount: content.split(/\s+/).length,
    seoScore: calculateSEOScore({ keywordInTitle, keywordInContent, keywordDensity }),
  };
}

/**
 * Calculate basic SEO score
 * @param {object} factors - SEO factors
 * @returns {number} - SEO score out of 100
 */
function calculateSEOScore(factors) {
  let score = 50; // Base score

  if (factors.keywordInTitle) score += 20;
  if (factors.keywordInContent) score += 15;
  if (factors.keywordDensity > 0.5 && factors.keywordDensity < 3) score += 15;

  return Math.min(score, 100);
}

/**
 * Generate internal linking strategy for a blog post
 * @param {string} mainKeyword - Main blog keyword
 * @param {object} blogContent - Blog content object
 * @returns {object} - Internal linking strategy
 */
export function generateLinkingStrategy(mainKeyword, blogContent) {
  const relatedKeywords = generateRelatedKeywords(mainKeyword);
  
  return {
    mainKeyword,
    internalLinkTargets: relatedKeywords,
    strategy: {
      intro: "Link main keyword in intro if relevant",
      body: "Insert 2-3 contextual internal links in main body sections",
      conclusion: "Link related keywords in conclusion",
      cta: "Add strong call-to-action link at end",
    },
    maxLinks: 5,
    targetDensity: "1-2%",
  };
}
