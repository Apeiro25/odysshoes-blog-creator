let cheerio;

// Initialize cheerio - use direct require with try-catch
try {
  cheerio = require('cheerio');
} catch (err) {
  console.warn('Warning: Could not load cheerio at module level:', err.message);
  console.warn('Will attempt lazy loading on first use...');
}

// Lazy load cheerio if not loaded at module level
function getCheerio() {
  if (!cheerio) {
    try {
      cheerio = require('cheerio');
      console.log('✓ Successfully lazy-loaded cheerio');
    } catch (err) {
      console.error('Failed to load cheerio:', err.message);
      throw new Error('Cheerio library failed to load. Make sure cheerio package is installed.');
    }
  }
  return cheerio;
}

// In-memory cache with TTL
let blogCache = {
  data: null,
  timestamp: null,
  ttl: 30 * 60 * 1000, // 30 minutes
};

/**
 * Fetch all published blogs from odysshoes.com/blogs/news
 * @returns {Promise<Array>} Array of blog objects with title, slug, url, and fullText
 */
async function fetchPublishedBlogs() {
  try {
    // Check if cache is still valid
    if (blogCache.data && blogCache.timestamp && (Date.now() - blogCache.timestamp) < blogCache.ttl) {
      console.log('✓ Using cached blog data from odysshoes.com');
      return blogCache.data;
    }

    console.log('🌐 Fetching published blogs from odysshoes.com/blogs/news...');
    
    const response = await fetch('https://odysshoes.com/blogs/news', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BlogCreatorBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch odysshoes.com: ${response.statusText}`);
    }

    const html = await response.text();
    const blogs = await extractBlogMetadata(html);

    // Update cache
    blogCache.data = blogs;
    blogCache.timestamp = Date.now();

    console.log(`✓ Fetched ${blogs.length} published blogs from odysshoes.com`);
    return blogs;
  } catch (error) {
    console.error('Error fetching odysshoes.com blogs:', error.message);
    // Return cached data if available, even if expired
    if (blogCache.data) {
      console.log('⚠️ Using expired cache due to fetch error');
      return blogCache.data;
    }
    return [];
  }
}

/**
 * Extract blog metadata from HTML
 * @param {string} html - HTML content from odysshoes.com/blogs/news
 * @returns {Promise<Array>} Array of blog objects
 */
async function extractBlogMetadata(html) {
  try {
    // Get cheerio instance (with lazy loading if needed)
    const $ = getCheerio().load(html);
    const blogs = [];

    // Shopify blog post selector - typically uses article or post class
    // Common Shopify blog selectors: .article, .blog-post, .post, article
    const articleSelectors = ['article', '.article', '.blog-post', '.post', '[data-article-id]'];
    
    let articles = [];
    for (const selector of articleSelectors) {
      articles = $(selector);
      if (articles.length > 0) break;
    }

    articles.each((index, element) => {
      try {
        // Try different title selectors
        let titleElement = $(element).find('h1, h2, .article-title, .post-title, [data-article-title]').first();
        let title = titleElement.text().trim();

        // Try to get href/link
        let linkElement = $(element).find('a').first();
        let url = linkElement.attr('href') || '';

        // If no link found in article, try finding link to the article
        if (!url) {
          linkElement = $(element).find('a[href*="/blogs/news/"]').first();
          url = linkElement.attr('href') || '';
        }

        // Handle relative URLs
        if (url && !url.startsWith('http')) {
          url = `https://odysshoes.com${url}`;
        }

        // Extract slug from URL
        const slug = url ? url.split('/').pop() || '' : '';

        // Get excerpt/description
        let excerpt = '';
        const excerptElement = $(element).find('.article-excerpt, .post-excerpt, p').first();
        if (excerptElement.length) {
          excerpt = excerptElement.text().trim().substring(0, 200);
        }

        // Only add if we have a title and URL
        if (title && url) {
          blogs.push({
            title: title,
            slug: slug,
            url: url,
            excerpt: excerpt,
            fullText: `${title} ${excerpt}`, // Combined text for phrase matching
          });
        }
      } catch (err) {
        console.warn(`Error extracting article ${index}:`, err.message);
      }
    });

    return blogs;
  } catch (error) {
    console.error('Error parsing HTML:', error.message);
    return [];
  }
}

/**
 * Find phrase matches between content and published blogs
 * @param {string} content - Generated blog content to check
 * @param {Array} publishedBlogs - Array of published blog objects
 * @returns {Array} Array of matching blogs
 */
function findPhraseMatches(content, publishedBlogs) {
  const matches = [];
  
  if (!content || !publishedBlogs || publishedBlogs.length === 0) {
    return matches;
  }

  // Convert content to lowercase for case-insensitive matching
  const contentLower = content.toLowerCase();

  publishedBlogs.forEach((blog) => {
    const blogTitle = blog.title.toLowerCase();
    const blogSlug = blog.slug.toLowerCase();
    const blogExcerpt = blog.excerpt.toLowerCase();

    // Check for phrase matches
    // 1. Exact title match
    if (contentLower.includes(blogTitle)) {
      matches.push({
        ...blog,
        matchType: 'exact_title',
        matchedText: blogTitle,
      });
      return;
    }

    // 2. Title words match (at least 80% of title words)
    const titleWords = blogTitle.split(/\s+/).filter(w => w.length > 3); // Words > 3 chars
    if (titleWords.length > 0) {
      const matchedWords = titleWords.filter(word => contentLower.includes(word)).length;
      const matchPercentage = (matchedWords / titleWords.length) * 100;
      
      if (matchPercentage >= 80) {
        matches.push({
          ...blog,
          matchType: 'title_words',
          matchedPercentage: Math.round(matchPercentage),
          matchedWords: titleWords.filter(word => contentLower.includes(word)),
        });
        return;
      }
    }

    // 3. Slug phrase match
    if (blogSlug && contentLower.includes(blogSlug.replace(/-/g, ' '))) {
      matches.push({
        ...blog,
        matchType: 'slug_match',
        matchedText: blogSlug,
      });
      return;
    }

    // 4. Keyword extraction from slug and title - if multiple keywords from blog appear in content
    const blogKeywords = [
      ...blogTitle.split(/\s+/),
      ...blogSlug.split(/-/),
    ]
      .filter(w => w.length > 3)
      .map(w => w.toLowerCase());

    const matchedKeywords = blogKeywords.filter(kw => contentLower.includes(kw));
    if (matchedKeywords.length >= 2) {
      matches.push({
        ...blog,
        matchType: 'keyword_match',
        matchedKeywords: matchedKeywords,
      });
      return;
    }
  });

  return matches;
}

/**
 * Check if a keyword already exists in published blogs
 * @param {string} keyword - Keyword to check
 * @param {Array} publishedBlogs - Array of published blog objects
 * @returns {Object} Duplicate check result
 */
function checkKeywordInPublishedBlogs(keyword, publishedBlogs) {
  if (!keyword || !publishedBlogs || publishedBlogs.length === 0) {
    return {
      isDuplicate: false,
      matchCount: 0,
      matches: [],
    };
  }

  const keywordLower = keyword.toLowerCase();
  const matches = [];

  publishedBlogs.forEach((blog) => {
    const blogTitleLower = blog.title.toLowerCase();
    const blogSlugLower = blog.slug.toLowerCase();

    // Exact match
    if (blogTitleLower.includes(keywordLower) || blogSlugLower.includes(keywordLower)) {
      matches.push({
        blog: blog,
        matchType: 'exact_keyword',
      });
    }

    // Title word match
    const keywordWords = keywordLower.split(/\s+/);
    const titleWords = blogTitleLower.split(/\s+/);
    const commonWords = keywordWords.filter(kw => 
      titleWords.some(tw => tw.includes(kw) || kw.includes(tw))
    );

    if (commonWords.length >= Math.max(1, keywordWords.length - 1)) {
      matches.push({
        blog: blog,
        matchType: 'similar_keyword',
        commonWords: commonWords,
      });
    }
  });

  return {
    isDuplicate: matches.length > 0,
    matchCount: matches.length,
    matches: matches,
  };
}

/**
 * Get cache status
 * @returns {Object} Cache status information
 */
function getCacheStatus() {
  if (!blogCache.data) {
    return { status: 'empty', blogs: 0, age: null };
  }

  const age = Date.now() - blogCache.timestamp;
  const isValid = age < blogCache.ttl;

  return {
    status: isValid ? 'valid' : 'expired',
    blogs: blogCache.data.length,
    age: age,
    ageMinutes: Math.round(age / 1000 / 60),
    ttlMinutes: Math.round(blogCache.ttl / 1000 / 60),
  };
}

/**
 * Clear cache manually
 */
function clearCache() {
  blogCache = {
    data: null,
    timestamp: null,
    ttl: 30 * 60 * 1000,
  };
  console.log('✓ Blog cache cleared');
}

/**
 * Get blogs from cache (without fetching)
 * @returns {Array} Cached blog data or empty array
 */
function getCachedBlogs() {
  if (!blogCache.data || (Date.now() - blogCache.timestamp) >= blogCache.ttl) {
    return [];
  }
  return blogCache.data;
}

export {
  fetchPublishedBlogs,
  extractBlogMetadata,
  findPhraseMatches,
  checkKeywordInPublishedBlogs,
  getCacheStatus,
  clearCache,
  getCachedBlogs,
};
