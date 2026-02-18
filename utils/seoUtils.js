/**
 * SEO Utilities for keyword research, link optimization, and internal linking
 */

/**
 * Generate keywords related to the main topic for internal linking
 * @param {string} mainKeyword - The main blog keyword
 * @returns {Array} - Array of related keywords with URLs
 */
export function generateRelatedKeywords(mainKeyword) {
  // Common related keyword patterns for customizable shoes blog
  const keywordDatabase = {
    "custom shoes": [
      { keyword: "customize shoes", url: "/collections/custom-shoes" },
      { keyword: "personalized footwear", url: "/collections/custom-shoes" },
      { keyword: "custom shoe design", url: "/collections/custom-shoes" },
      { keyword: "bespoke shoes", url: "/collections/custom-shoes" },
    ],
    "basketball shoes": [
      { keyword: "customize basketball shoes", url: "/collections/custom-basketball-shoes" },
      { keyword: "custom basketball sneakers", url: "/collections/custom-basketball-shoes" },
      { keyword: "personalized basketball shoes", url: "/collections/custom-basketball-shoes" },
      { keyword: "custom hoops shoes", url: "/collections/custom-basketball-shoes" },
    ],
    "shoe customization": [
      { keyword: "shoe design", url: "/collections/custom-shoes" },
      { keyword: "shoe personalization", url: "/collections/custom-shoes" },
      { keyword: "custom footwear options", url: "/collections/custom-shoes" },
    ],
    "sneaker design": [
      { keyword: "design your own sneakers", url: "/collections/custom-shoes" },
      { keyword: "custom sneaker design", url: "/collections/custom-shoes" },
      { keyword: "sneaker customization", url: "/collections/custom-shoes" },
    ],
  };

  // Find related keywords
  let relatedKeywords = [];
  
  for (const [key, value] of Object.entries(keywordDatabase)) {
    if (mainKeyword.toLowerCase().includes(key) || key.includes(mainKeyword.toLowerCase())) {
      relatedKeywords = [...relatedKeywords, ...value];
    }
  }

  // If no matches found, return generic customization keywords
  if (relatedKeywords.length === 0) {
    relatedKeywords = [
      { keyword: "customize shoes", url: "/collections/custom-shoes" },
      { keyword: "custom basketball shoes", url: "/collections/custom-basketball-shoes" },
    ];
  }

  return relatedKeywords.slice(0, 5); // Return top 5
}

/**
 * Analyze content and insert internal links naturally
 * @param {string} content - The blog post content (HTML)
 * @param {string} mainKeyword - The main blog keyword
 * @returns {string} - Content with internal links inserted
 */
export function insertInternalLinks(content, mainKeyword) {
  try {
    const relatedKeywords = generateRelatedKeywords(mainKeyword);
    let modifiedContent = content;
    let linksInserted = 0;
    const maxLinksPerKeyword = 2;

    // For each related keyword, find natural places to insert links
    relatedKeywords.forEach((item) => {
      const { keyword, url } = item;
      
      // Create regex to find the keyword with word boundaries
      const regex = new RegExp(`\\b${keyword}\\b(?!.*?<\\/a>)`, "gi");
      let matches = 0;

      // Replace only first 2 occurrences to avoid over-linking
      modifiedContent = modifiedContent.replace(regex, (match) => {
        if (matches < maxLinksPerKeyword && linksInserted < 5) {
          matches++;
          linksInserted++;
          return `<a href="${url}" title="${keyword}">${match}</a>`;
        }
        return match;
      });
    });

    console.log(`Inserted ${linksInserted} internal links`);
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
