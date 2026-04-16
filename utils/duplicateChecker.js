import { supabase, publishedBlogsDatabase } from "./supabaseClient.js";

/**
 * Checks for keyword duplicates using multiple strategies:
 * 1. Phrase Match (exact match)
 * 2. Broad Match (fuzzy matching with similarity score)
 * 3. Database Check (published blogs)
 * 4. Website Check (existing blog posts at odysshoes.com)
 */

// Levenshtein distance for fuzzy matching
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / parseFloat(longer.length);
}

function getEditDistance(s1, s2) {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// Known existing blogs at odysshoes.com (fetched from website)
const EXISTING_ODYSSHOES_BLOGS = [
  "refresh your white shoes to perfection using baking soda",
  "top shoe brands for plantar fasciitis relief a comprehensive review",
  "spring shoe trends fresh styles to step up your footwear game",
  "keeping your shoes fresh tips to eliminate odor",
  "perfect pairings what shoes to wear with a midi dress",
  "how to stretch shoes for wide feet simple techniques that work",
  "trending shoe colors for summer your fashion color palette",
  "exploring comfort the best shoes for walking enthusiasts",
  "discover the best shoes for standing all day comfort meets durability",
  "stylish footwear choices to pair with your jumpsuit",
  "exploring the importance of hard soled shoes in everyday footwear",
  "understanding how long foot fungus can live in shoes"
];

/**
 * Check if keyword contains year 2025 or below
 */
export function hasOldYear(keyword) {
  // Check for years 2025 and below
  const yearPattern = /(\b(?:19|20)\d{2}\b)|(\b[0-9]{1,2}['\-]?\d{2}\b)/g;
  const matches = keyword.match(yearPattern);
  
  if (!matches) return false;
  
  return matches.some(year => {
    let fullYear = year;
    // Handle short year format (e.g., '25 or '24)
    if (year.length === 2 || (year.includes("'") && year.length === 3)) {
      const shortYear = parseInt(year.replace(/[''-]/g, ""));
      fullYear = shortYear > 50 ? "19" + shortYear : "20" + shortYear;
    }
    
    const numYear = parseInt(fullYear);
    return numYear <= 2025;
  });
}

/**
 * Check if keyword is a phrase match (exact) of any used keyword
 * Returns { isMatch: boolean, matchedKeyword?: string }
 */
export async function checkPhraseMatch(keyword) {
  try {
    const usedKeywords = await publishedBlogsDatabase.getUsedKeywords();
    
    const keywordLower = keyword.toLowerCase().trim();
    
    for (const used of usedKeywords) {
      if (used.toLowerCase().trim() === keywordLower) {
        return { isMatch: true, matchedKeyword: used, type: "PHRASE_MATCH" };
      }
    }
    
    return { isMatch: false };
  } catch (error) {
    console.warn("Error checking phrase match:", error);
    return { isMatch: false };
  }
}

/**
 * Check if keyword is a broad match (fuzzy matching) with similarity threshold
 * Returns { isMatch: boolean, similarKeywords?: array, score?: number }
 * Threshold: 0.80 (80% similarity)
 */
export async function checkBroadMatch(keyword, similarityThreshold = 0.80) {
  try {
    const usedKeywords = await publishedBlogsDatabase.getUsedKeywords();
    
    const keywordLower = keyword.toLowerCase().trim();
    const similarKeywords = [];
    
    for (const used of usedKeywords) {
      const similarity = calculateSimilarity(keywordLower, used.toLowerCase().trim());
      
      // Only return matches above threshold
      if (similarity >= similarityThreshold && similarity < 1.0) {
        // Exclude exact matches (those are phrase matches)
        similarKeywords.push({
          keyword: used,
          similarity: Math.round(similarity * 100),
        });
      }
    }
    
    return {
      isMatch: similarKeywords.length > 0,
      similarKeywords,
      type: "BROAD_MATCH",
    };
  } catch (error) {
    console.warn("Error checking broad match:", error);
    return { isMatch: false, similarKeywords: [] };
  }
}

/**
 * Check if keyword exists in odysshoes.com existing blogs
 * Returns { isMatch: boolean, matchedBlog?: string }
 */
export function checkExistingBlogsMatch(keyword, similarityThreshold = 0.75) {
  const keywordLower = keyword.toLowerCase().trim();
  const matches = [];
  
  for (const blog of EXISTING_ODYSSHOES_BLOGS) {
    // Phrase match (exact)
    if (blog === keywordLower) {
      return {
        isMatch: true,
        matchedBlog: blog,
        type: "PHRASE_MATCH",
        similarity: 100,
      };
    }
    
    // Check if any major words in blog match keyword
    const blogWords = blog.split(" ");
    const keywordWords = keywordLower.split(" ");
    
    const commonWords = blogWords.filter(word => keywordWords.includes(word));
    if (commonWords.length / Math.max(blogWords.length, keywordWords.length) >= similarityThreshold) {
      const similarity = Math.round((commonWords.length / Math.max(blogWords.length, keywordWords.length)) * 100);
      matches.push({
        blog,
        similarity,
      });
    }
  }
  
  if (matches.length > 0) {
    return {
      isMatch: true,
      matchedBlogs: matches,
      type: "BROAD_MATCH",
    };
  }
  
  return { isMatch: false };
}

/**
 * Comprehensive duplicate check - combines all strategies
 * Returns detailed report
 */
export async function checkForDuplicates(keyword) {
  const report = {
    keyword,
    isDuplicate: false,
    checks: {
      hasOldYear: false,
      phraseMatch: null,
      broadMatch: null,
      existingBlogsMatch: null,
    },
    warnings: [],
    recommendation: "PROCEED",
  };
  
  // Check 1: Year validation
  report.checks.hasOldYear = hasOldYear(keyword);
  if (report.checks.hasOldYear) {
    report.warnings.push("⚠️ Keyword contains year 2025 or earlier");
    report.isDuplicate = true;
    report.recommendation = "STOP - Year outdated";
    return report;
  }
  
  // Check 2: Phrase match (exact)
  try {
    report.checks.phraseMatch = await checkPhraseMatch(keyword);
    if (report.checks.phraseMatch.isMatch) {
      report.warnings.push(`🔴 PHRASE MATCH: Exact duplicate of "${report.checks.phraseMatch.matchedKeyword}"`);
      report.isDuplicate = true;
      report.recommendation = "STOP - Exact duplicate found";
      return report;
    }
  } catch (error) {
    console.warn("Phrase match check failed:", error);
  }
  
  // Check 3: Broad match (fuzzy)
  try {
    report.checks.broadMatch = await checkBroadMatch(keyword, 0.80);
    if (report.checks.broadMatch.isMatch) {
      const similar = report.checks.broadMatch.similarKeywords[0];
      report.warnings.push(`🟡 BROAD MATCH: Similar to "${similar.keyword}" (${similar.similarity}% match)`);
      // Broad match is warning, not hard stop
      if (report.checks.broadMatch.similarKeywords[0].similarity >= 90) {
        report.recommendation = "CAUTION - Very similar content exists";
      }
    }
  } catch (error) {
    console.warn("Broad match check failed:", error);
  }
  
  // Check 4: Existing blogs at odysshoes.com
  report.checks.existingBlogsMatch = checkExistingBlogsMatch(keyword, 0.75);
  if (report.checks.existingBlogsMatch.isMatch) {
    if (report.checks.existingBlogsMatch.type === "PHRASE_MATCH") {
      report.warnings.push(`🔴 EXACT MATCH on odysshoes.com: "${report.checks.existingBlogsMatch.matchedBlog}"`);
      report.isDuplicate = true;
      report.recommendation = "STOP - Already published on odysshoes.com";
      return report;
    } else {
      const matchedBlogs = report.checks.existingBlogsMatch.matchedBlogs[0];
      report.warnings.push(`🟡 SIMILAR BLOG on odysshoes.com: "${matchedBlogs.blog}" (${matchedBlogs.similarity}% match)`);
      if (matchedBlogs.similarity >= 85) {
        report.recommendation = "CAUTION - Very similar blog already published";
      }
    }
  }
  
  // Final recommendation
  if (!report.isDuplicate && report.recommendation === "PROCEED") {
    report.recommendation = "✅ SAFE - No duplicates found";
  }
  
  return report;
}

/**
 * Update existing odysshoes blogs list (call this periodically)
 * In production, fetch from odysshoes.com/blogs/news dynamically
 */
export async function updateExistingBlogs(blogTitles) {
  // This would be called after fetching latest blogs from odysshoes.com
  // For now, manual updates can be done by modifying EXISTING_ODYSSHOES_BLOGS
  console.log("Updating existing blogs list...");
  console.log(`Now tracking ${blogTitles.length} existing blogs`);
}

/**
 * Fetch all blogs from odysshoes.com/blogs/news (future enhancement)
 */
export async function fetchExistingBlogsFromWebsite() {
  try {
    const response = await fetch("https://odysshoes.com/blogs/news.json");
    if (!response.ok) {
      console.warn("Could not fetch odysshoes blogs from API");
      return EXISTING_ODYSSHOES_BLOGS;
    }
    
    const data = await response.json();
    // Extract titles from response
    const blogs = data.articles?.map(article => article.title.toLowerCase()) || [];
    return [...new Set([...EXISTING_ODYSSHOES_BLOGS, ...blogs])];
  } catch (error) {
    console.warn("Error fetching odysshoes blogs:", error);
    return EXISTING_ODYSSHOES_BLOGS;
  }
}
