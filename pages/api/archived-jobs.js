import { jobDatabase } from "../../utils/supabaseClient.js";
import { blogDatabase } from "../../utils/blogDatabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use GET or POST." });
  }

  const { jobId, action } = req.method === "POST" ? req.body : req.query;

  try {
    if (req.method === "GET") {
      // Get all archived jobs
      const archivedJobs = await jobDatabase.getArchivedJobs();

      const jobDetails = await Promise.all(
        archivedJobs.map(async (job) => {
          const blogs = await blogDatabase.getJobBlogs(job.id);
          return {
            jobId: job.id,
            keywords: job.keywords,
            times: job.times,
            shopifyShop: job.shopify_shop,
            createdAt: job.created_at,
            stoppedAt: job.stopped_at,
            totalBlogsPosted: blogs.length,
            downloadOptions: {
              json: `/api/download-blogs?jobId=${job.id}&format=json`,
              csv: `/api/download-blogs?jobId=${job.id}&format=csv`,
            },
          };
        })
      );

      return res.status(200).json({
        message: "Archived posting jobs",
        totalArchived: jobDetails.length,
        archivedJobs: jobDetails,
        nextSteps: "Use POST with jobId and action='delete' to permanently delete an archived job",
      });
    }

    // POST: Perform action on archived job
    if (!jobId || !action) {
      return res.status(400).json({
        error: "jobId and action are required",
        example: '{"jobId": "schedule-1234567890", "action": "delete"}',
      });
    }

    if (action === "delete") {
      // Permanently delete an archived job
      const deleted = await jobDatabase.deleteArchivedJob(jobId);

      if (!deleted) {
        return res.status(500).json({
          error: "Failed to delete archived job",
          jobId,
        });
      }

      return res.status(200).json({
        message: "Archived job permanently deleted",
        jobId,
        note: "Published blogs remain in the database for historical reference unless also deleted",
      });
    } else {
      return res.status(400).json({
        error: `Unknown action: ${action}`,
        availableActions: ["delete"],
      });
    }
  } catch (error) {
    console.error("Error managing archived jobs:", error);
    return res.status(500).json({
      error: "Failed to manage archived jobs",
      details: error.message,
    });
  }
}
