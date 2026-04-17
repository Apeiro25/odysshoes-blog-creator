import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generates new keywords using OpenAI based on initial keywords
 */
export async function generateKeywords(
  initialKeywords,
  usedKeywords = [],
  niche = "shoes",
  count = 10
) {
  try {
    console.log(
      `Generating ${count} new keywords for niche: ${niche}...`
    );

    const usedKeywordsStr =
      usedKeywords.length > 0
        ? `\n\nAlready used keywords (DO NOT REPEAT): ${usedKeywords.join(", ")}`
        : "";

    const prompt = `You are an SEO expert specializing in the ${niche} industry. 
I need you to generate exactly ${count} new, unique, and relevant blog post keywords related to "${niche}".

These should be:
- Long-tail keywords (2-4 words)
- High search intent
- Related to the niche but NOT duplicates of existing ones
- Specific and actionable (e.g., "how to...", "best...", "what is...")
- Trending and relevant
- NO keywords containing years (2025 or older)
- NO keywords containing "near me"
- NO keywords containing "services"

Initial reference keywords: ${initialKeywords.join(", ")}
${usedKeywordsStr}

Return ONLY a JSON array of keywords with no additional text:
["keyword 1", "keyword 2", "keyword 3", ...]`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const content = response.choices[0].message.content;

    // Parse the JSON array
    let keywords = [];
    try {
      // Try to extract JSON array from response
      const jsonMatch = content.match(/\[.*\]/s);
      if (jsonMatch) {
        keywords = JSON.parse(jsonMatch[0]);
      } else {
        keywords = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse keywords response:", content);
      throw new Error("Invalid keyword format from AI");
    }

    // Validate and clean keywords
    const excludedTerms = ["near me", "services"];
    const yearPattern = /(\b(?:19|20)\d{2}\b)|(\b[0-9]{1,2}['\-]?\d{2}\b)/g;
    
    const hasOldYear = (keyword) => {
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
    };
    
    keywords = keywords
      .filter((kw) => {
        // Filter out used keywords
        if (usedKeywords.some((used) => used.toLowerCase() === kw.toLowerCase())) {
          console.log(`Skipping duplicate keyword: ${kw}`);
          return false;
        }
        
        // Filter out keywords with old years (2025 or below)
        if (hasOldYear(kw)) {
          console.log(`Skipping keyword with old year: ${kw}`);
          return false;
        }
        
        // Filter out keywords containing excluded terms
        const kwLower = kw.toLowerCase();
        for (const term of excludedTerms) {
          if (kwLower.includes(term)) {
            console.log(`Skipping keyword with excluded term "${term}": ${kw}`);
            return false;
          }
        }
        
        return kw && typeof kw === "string" && kw.trim().length > 0;
      })
      .map((kw) => kw.trim())
      .slice(0, count);

    if (keywords.length === 0) {
      throw new Error("No valid keywords generated");
    }

    console.log(`✓ Generated ${keywords.length} new keywords:`, keywords);
    return keywords;
  } catch (error) {
    console.error("Error generating keywords:", error);
    throw error;
  }
}

/**
 * Generates keywords for a specific niche without initial keywords
 */
export async function generateKeywordsForNiche(niche, count = 10) {
  try {
    console.log(`Generating ${count} keywords for niche: ${niche}...`);

    const prompt = `You are an SEO expert. Generate exactly ${count} unique, high-quality blog post keywords for the "${niche}" niche.

Requirements:
- Long-tail keywords (2-4 words)
- High search volume and intent
- Actionable and specific
- Popular blog topics format
- NO keywords containing years (2025 or older)
- NO keywords containing "near me"
- NO keywords containing "services"

Return ONLY a JSON array with no additional text:
["keyword 1", "keyword 2", ...]`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const content = response.choices[0].message.content;

    // Parse the JSON array
    let keywords = [];
    try {
      const jsonMatch = content.match(/\[.*\]/s);
      if (jsonMatch) {
        keywords = JSON.parse(jsonMatch[0]);
      } else {
        keywords = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse keywords response:", content);
      throw new Error("Invalid keyword format from AI");
    }

    keywords = keywords
      .filter((kw) => {
        // Validate keyword format
        if (!kw || typeof kw !== "string" || kw.trim().length === 0) {
          return false;
        }
        
        // Check for old years (2025 or below)
        const yearPattern = /(\b(?:19|20)\d{2}\b)|(\b[0-9]{1,2}['\-]?\d{2}\b)/g;
        const matches = kw.match(yearPattern);
        if (matches) {
          const hasOldYear = matches.some(year => {
            let fullYear = year;
            if (year.length === 2 || (year.includes("'") && year.length === 3)) {
              const shortYear = parseInt(year.replace(/[''-]/g, ""));
              fullYear = shortYear > 50 ? "19" + shortYear : "20" + shortYear;
            }
            const numYear = parseInt(fullYear);
            return numYear <= 2025;
          });
          
          if (hasOldYear) {
            console.log(`Skipping keyword with old year: ${kw}`);
            return false;
          }
        }
        
        // Filter out keywords containing excluded terms
        const excludedTerms = ["near me", "services"];
        const kwLower = kw.toLowerCase();
        for (const term of excludedTerms) {
          if (kwLower.includes(term)) {
            console.log(`Skipping keyword with excluded term "${term}": ${kw}`);
            return false;
          }
        }
        
        return true;
      })
      .map((kw) => kw.trim())
      .slice(0, count);

    console.log(`✓ Generated ${keywords.length} keywords for ${niche}:`, keywords);
    return keywords;
  } catch (error) {
    console.error("Error generating keywords for niche:", error);
    throw error;
  }
}
