import { jobManager } from "../../utils/jobManager.js";
import { logManager } from "../../utils/logManager.js";
import { jobDatabase } from "../../utils/supabaseClient.js";
import { blogDatabase } from "../../utils/blogDatabase.js";

export default async function handler(req, res) {
  // Allow both POST and GET requests for flexibility
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use POST or GET." });
  }

  const { jobId } = req.method === "POST" ? req.body : req.query;

  // If no jobId provided, show available jobs
  if (!jobId) {
    let allJobs = jobManager.getAllJobs();
    const allLogs = logManager.getAllLogs();
    
    console.log("[API] Current jobs in memory:", Object.keys(allJobs));
    
    // If no jobs in memory, load from Supabase
    if (Object.keys(allJobs).length === 0) {
      console.log("[API] No jobs in memory, loading from Supabase...");
      try {
        const jobsFromDb = await jobDatabase.getAllJobs();
        console.log("[API] Found jobs in Supabase:", jobsFromDb.map(j => j.id));
        
        // Populate jobManager with jobs from database
        for (const job of jobsFromDb) {
          const jobData = {
            keywords: job.keywords,
            times: job.times,
            shopifyShop: job.shopify_shop,
            shopifyBlogId: job.shopify_blog_id,
            shopifyToken: job.shopify_token,
            createdAt: job.created_at,
            scheduledTasks: [], // Empty - we're just loading for display
          };
          await jobManager.addJob(job.id, jobData);
        }
        
        // Get updated jobs
        allJobs = jobManager.getAllJobs();
        console.log("[API] Jobs now in memory:", Object.keys(allJobs));
      } catch (dbError) {
        console.error("[API] Error loading jobs from Supabase:", dbError);
      }
    }
    
    const jobList = Object.entries(allJobs).map(([id, details]) => {
      console.log(`[API] Processing job ${id}:`, details);
      const logs = allLogs[id] || {};
      const postedKeywords = logManager.getPostedKeywords(id);
      return {
        jobId: id,
        keywords: details.keywords,
        times: details.times,
        createdAt: details.createdAt,
        postedCount: logs.postedBlogs?.filter((b) => b.status === "success").length || 0,
        totalKeywords: details.keywords.length,
      };
    });

    console.log("[API] Jobs to return:", jobList);
    return res.status(200).json({
      message: "Active scheduled posting jobs",
      activeJobs: jobList,
      instruction: "Send a POST request to /api/stop-posting with jobId to stop a job",
    });
  }

  // Validate jobId
  if (typeof jobId !== "string") {
    return res.status(400).json({ error: "jobId must be a string" });
  }

  try {
    // Get the job
    const job = jobManager.getJob(jobId);

    if (!job) {
      return res.status(404).json({ 
        error: `Job not found: ${jobId}`,
        hint: "The job may have already been stopped or completed, or the server was restarted.",
        availableJobs: Object.keys(jobManager.getAllJobs()),
      });
    }

    // Stop all cron tasks associated with this job
    for (const { task } of job.scheduledTasks) {
      task.stop();
      task.destroy();
    }

    // Mark as completed in logs
    logManager.markJobCompleted(jobId);

    // Archive job in Supabase (keep data for download, don't delete)
    await jobDatabase.archiveJob(jobId);

    // Remove from memory manager
    await jobManager.removeJob(jobId);

    // Get all published blogs for this job (handle if table doesn't exist)
    let publishedBlogs = [];
    try {
      publishedBlogs = await blogDatabase.getJobBlogs(jobId);
    } catch (blogError) {
      console.warn(`[WARNING] Could not fetch published blogs (table may not exist):`, blogError.message);
      // Continue without blog data - table might not be created yet
    }

    console.log(`Stopped scheduled posting job: ${jobId}`);

    return res.status(200).json({
      message: "Scheduled posting job stopped successfully",
      jobId,
      keywords: job.keywords,
      times: job.times,
      stoppedAt: new Date().toISOString(),
      summary: {
        totalKeywordsPooled: job.keywords.length,
        blogsPosted: publishedBlogs.length,
      },
      publishedBlogs: publishedBlogs.map((blog) => ({
        keyword: blog.keyword,
        title: blog.title,
        slug: blog.slug,
        imageUrl: blog.image_url,
        metaDescription: blog.meta_description,
        generatedAt: blog.generated_at,
      })),
      downloadOptions: {
        jsonDownload: `/api/download-blogs?jobId=${jobId}&format=json`,
        csvDownload: `/api/download-blogs?jobId=${jobId}&format=csv`,
        viewAllBlogs: `/api/published-blogs?jobId=${jobId}`,
      },
      note: "Job data is archived and available for download before permanent deletion",
    });
  } catch (error) {
    console.error("Error stopping scheduled posting job:", error);
    return res.status(500).json({ error: "Failed to stop scheduled posting job", details: error.message });
  }
}
