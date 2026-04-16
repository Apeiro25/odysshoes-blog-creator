import { monitorCompetitorAndGenerateKeywords, getCompetitorMonitoringStats } from "../../utils/competitorMonitoring.js";
import { publishedBlogsDatabase } from "../../utils/supabaseClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { competitorUrls = [], mode = "generate" } = req.body;

  // Validate required parameters
  if (!competitorUrls || competitorUrls.length === 0) {
    return res.status(400).json({
      error: "Competitor URLs are required (array of URLs)",
      example: { competitorUrls: ["https://competitor1.com", "https://competitor2.com"], mode: "generate" },
    });
  }

  try {
    if (mode === "generate") {
      // Generate keywords from competitor blogs
      console.log("Mode: Generate keywords from competitors");

      // Get already used keywords
      const usedKeywords = await publishedBlogsDatabase.getUsedKeywords();
      console.log(`Avoiding ${usedKeywords.length} already-used keywords`);

      // Monitor competitors and generate keywords
      const keywords = await monitorCompetitorAndGenerateKeywords(
        competitorUrls,
        usedKeywords,
        20
      );

      if (keywords.length === 0) {
        return res.status(500).json({
          error: "Failed to generate keywords from competitors",
          note: "Ensure competitor URLs are valid and have accessible blogs",
        });
      }

      return res.status(200).json({
        success: true,
        mode: "generate",
        keywords,
        count: keywords.length,
        generatedAt: new Date().toISOString(),
      });
    } else if (mode === "stats") {
      // Get monitoring statistics
      console.log("Mode: Get competitor monitoring stats");

      const stats = await getCompetitorMonitoringStats(competitorUrls);

      return res.status(200).json({
        success: true,
        mode: "stats",
        stats,
      });
    } else {
      return res.status(400).json({
        error: "Invalid mode. Use 'generate' or 'stats'",
      });
    }
  } catch (error) {
    console.error("Competitor monitoring error:", error);
    return res.status(500).json({
      error: "Failed to process competitor monitoring",
      details: error.message,
    });
  }
}
