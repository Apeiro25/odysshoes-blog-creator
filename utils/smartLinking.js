/**
 * Smart Internal Linking
 * Fetches Shopify store structure and generates intelligent internal links
 */

import { cache } from 'react';

// Cache Shopify data to avoid repeated API calls
let cachedShopifyLinks = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 3600000; // 1 hour

/**
 * Fetch all collections from Shopify
 */
async function fetchShopifyCollections(shopifyShop, shopifyToken) {
  try {
    console.log("Fetching Shopify collections...");
    
    const response = await fetch(
      `https://${shopifyShop}/admin/api/2024-01/collections.json`,
      {
        headers: {
          "X-Shopify-Access-Token": shopifyToken,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch collections:", response.statusText);
      return [];
    }

    const data = await response.json();
    return data.collections || [];
  } catch (error) {
    console.error("Error fetching collections:", error);
    return [];
  }
}

/**
 * Fetch all products from Shopify
 */
async function fetchShopifyProducts(shopifyShop, shopifyToken) {
  try {
    console.log("Fetching Shopify products...");
    
    const response = await fetch(
      `https://${shopifyShop}/admin/api/2024-01/products.json?limit=250`,
      {
        headers: {
          "X-Shopify-Access-Token": shopifyToken,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch products:", response.statusText);
      return [];
    }

    const data = await response.json();
    return data.products || [];
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}

/**
 * Build internal linking database from Shopify store structure
 */
export async function buildSmartLinkingDatabase(shopifyShop, shopifyToken) {
  try {
    // Check cache first
    const now = Date.now();
    if (cachedShopifyLinks && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log("Using cached Shopify links");
      return cachedShopifyLinks;
    }

    const collections = await fetchShopifyCollections(shopifyShop, shopifyToken);
    const products = await fetchShopifyProducts(shopifyShop, shopifyToken);

    const linkDatabase = [];

    // Add collections to database
    collections.forEach((collection) => {
      if (collection.title && collection.handle) {
        linkDatabase.push({
          keyword: collection.title.toLowerCase(),
          url: `/collections/${collection.handle}`,
          type: "collection",
          title: collection.title,
        });

        // Also add plural and variations
        const variations = [
          collection.title,
          collection.title + "s",
          "buy " + collection.title,
          "shop " + collection.title,
          "custom " + collection.title,
        ];

        variations.forEach((variation) => {
          linkDatabase.push({
            keyword: variation.toLowerCase(),
            url: `/collections/${collection.handle}`,
            type: "collection",
            title: collection.title,
          });
        });
      }
    });

    // Add products to database (limit to prevent over-linking)
    products.slice(0, 50).forEach((product) => {
      if (product.title && product.handle) {
        linkDatabase.push({
          keyword: product.title.toLowerCase(),
          url: `/products/${product.handle}`,
          type: "product",
          title: product.title,
        });

        // Add keyword variations
        const words = product.title.split(" ");
        if (words.length > 1) {
          linkDatabase.push({
            keyword: words.slice(0, -1).join(" ").toLowerCase(),
            url: `/products/${product.handle}`,
            type: "product",
            title: product.title,
          });
        }
      }
    });

    // Cache the results
    cachedShopifyLinks = linkDatabase;
    cacheTimestamp = now;

    console.log(`Built linking database with ${linkDatabase.length} links`);
    return linkDatabase;
  } catch (error) {
    console.error("Error building linking database:", error);
    return [];
  }
}

/**
 * Smart insert internal links based on Shopify store structure
 */
export function smartInsertInternalLinks(content, shopifyLinkDatabase) {
  if (!shopifyLinkDatabase || shopifyLinkDatabase.length === 0) {
    console.warn("No link database provided");
    return content;
  }

  try {
    let modifiedContent = content;
    let linksInserted = 0;
    const maxTotalLinks = 8;
    const maxLinksPerKeyword = 2;

    // Sort by keyword length (longest first) to match most specific terms first
    const sortedDatabase = [...shopifyLinkDatabase].sort(
      (a, b) => b.keyword.length - a.keyword.length
    );

    // For each keyword, find natural places to insert links
    sortedDatabase.forEach((item) => {
      if (linksInserted >= maxTotalLinks) return;

      const { keyword, url, type, title } = item;

      // Create regex to find keyword with word boundaries
      // Avoid linking already-linked content
      const regex = new RegExp(`\\b${keyword}\\b(?!.*?<\\/a>)`, "gi");
      let matches = 0;

      modifiedContent = modifiedContent.replace(regex, (match) => {
        // Skip if already linked
        if (modifiedContent.includes(`<a href="${url}"`)) {
          return match;
        }

        if (matches < maxLinksPerKeyword && linksInserted < maxTotalLinks) {
          matches++;
          linksInserted++;
          const linkTitle = type === "product" ? `Check out ${title}` : `Shop ${title}`;
          return `<a href="${url}" title="${linkTitle}">${match}</a>`;
        }
        return match;
      });
    });

    console.log(`Smart inserted ${linksInserted} internal links`);
    return modifiedContent;
  } catch (error) {
    console.error("Error inserting smart links:", error);
    return content;
  }
}

/**
 * Analyze link opportunities in content
 */
export function analyzeLinkOpportunities(content, shopifyLinkDatabase) {
  if (!shopifyLinkDatabase || shopifyLinkDatabase.length === 0) {
    return { opportunities: [], total: 0 };
  }

  const opportunities = [];
  const contentLower = content.toLowerCase();

  shopifyLinkDatabase.forEach((item) => {
    const { keyword, url, type, title } = item;
    const matches = (contentLower.match(new RegExp(keyword, "gi")) || []).length;

    if (matches > 0 && !content.includes(`<a href="${url}"`)) {
      opportunities.push({
        keyword,
        matches,
        url,
        type,
        title,
      });
    }
  });

  return {
    opportunities: opportunities.sort((a, b) => b.matches - a.matches),
    total: opportunities.length,
  };
}
