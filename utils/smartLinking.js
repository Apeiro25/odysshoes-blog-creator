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

    const [customRes, smartRes] = await Promise.all([
      fetch(`https://${shopifyShop}/admin/api/2025-01/custom_collections.json`, {
        headers: { "X-Shopify-Access-Token": shopifyToken },
      }),
      fetch(`https://${shopifyShop}/admin/api/2025-01/smart_collections.json`, {
        headers: { "X-Shopify-Access-Token": shopifyToken },
      }),
    ]);

    const customData = customRes.ok ? await customRes.json() : { custom_collections: [] };
    const smartData = smartRes.ok ? await smartRes.json() : { smart_collections: [] };

    return [
      ...( customData.custom_collections || []),
      ...( smartData.smart_collections || []),
    ];
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
      `https://${shopifyShop}/admin/api/2025-01/products.json?limit=250`,
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
 * With intelligent placement to prevent duplicate links of same keyword
 * and avoid over-linking
 */
export function smartInsertInternalLinks(content, shopifyLinkDatabase, mainKeyword = "") {
  if (!shopifyLinkDatabase || shopifyLinkDatabase.length === 0) {
    console.log("No Shopify link database available");
    return content;
  }

  try {
    let modifiedContent = content;
    let linksInserted = 0;
    const linkedKeywords = new Set(); // Track which keywords have been linked
    const linkPositions = []; // Track where links are placed
    const maxTotalLinks = 5; // Limit total product links
    const mainKeywordLower = mainKeyword.toLowerCase();

    // Sort by keyword length (longest first) to match most specific terms first
    const sortedDatabase = [...shopifyLinkDatabase].sort(
      (a, b) => b.keyword.length - a.keyword.length
    );

    // Split content into sections to manage link placement
    const sections = modifiedContent.split("<h2>");
    let processedSections = "";

    sections.forEach((section, sectionIndex) => {
      let sectionContent = sectionIndex > 0 ? "<h2>" + section : section;
      let sectionLinksAdded = 0;
      const maxLinksPerSection = 2; // Max 2 links per section

      // For each keyword, link ONLY the first occurrence in the section
      sortedDatabase.forEach((item) => {
        if (linksInserted >= maxTotalLinks || sectionLinksAdded >= maxLinksPerSection) {
          return;
        }

        const { keyword, url, type, title } = item;
        const keywordLower = keyword.toLowerCase();

        // Skip if we've already linked this keyword anywhere in the doc
        if (linkedKeywords.has(keywordLower)) {
          return;
        }

        // Skip if keyword is the main blog keyword (avoid redundant self-linking)
        if (mainKeywordLower && keywordLower === mainKeywordLower) {
          console.log(`Skipping self-link for main keyword: ${keyword}`);
          return;
        }

        // Skip if keyword is already in URL or anchor text
        if (sectionContent.includes(`value="${keyword}"`) || 
            sectionContent.includes(`title="${keyword}"`)) {
          return;
        }

        // Create regex to find keyword with word boundaries
        // Negative lookaheads prevent linking already-linked content
        const regex = new RegExp(
          `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b(?![^<]*>)(?![^<]*</a>)`,
          "i"
        );

        // Check if keyword exists and replace ONLY first occurrence
        if (regex.test(sectionContent)) {
          const beforeContent = sectionContent.substring(0, sectionContent.search(regex));
          const matchIndex = sectionContent.search(regex);

          // Intelligent placement: avoid intro/outro (first 500 chars, last 300 chars)
          const isInIntro = sectionIndex === 0 && matchIndex < 500;
          const isInOutro = sectionIndex === sections.length - 1 && 
                           matchIndex > sectionContent.length - 300;

          // Skip if in intro or outro sections
          if (isInIntro || isInOutro) {
            console.log(`Skipping link placement in intro/outro: ${keyword}`);
            return;
          }

          sectionContent = sectionContent.replace(regex, (match) => {
            linkedKeywords.add(keywordLower);
            linksInserted++;
            sectionLinksAdded++;
            linkPositions.push({
              keyword,
              section: sectionIndex,
              position: matchIndex,
            });

            const linkTitle = type === "product" ? `View ${title}` : `Shop ${title}`;
            return `<a href="${url}" title="${linkTitle}">${match}</a>`;
          });
        }
      });

      processedSections += sectionContent;
    });

    modifiedContent = processedSections;

    console.log(`Smart inserted ${linksInserted} product/collection links (1 per keyword, intelligent placement)`);
    console.log(`Link distribution: ${linkPositions.map(p => `"${p.keyword}" (section ${p.section})`).join(", ")}`);
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
