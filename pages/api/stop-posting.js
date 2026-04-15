import { jobManager } from "../../utils/jobManager.js";
import { logManager } from "../../utils/logManager.js";

export default async function handler(req, res) {
  // Allow both POST and GET requests for flexibility
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use POST or GET." });
  }

  const { jobId } = req.method === "POST" ? req.body : req.query;

  // If no jobId provided, show available jobs
  if (!jobId) {
    const allJobs = jobManager.getAllJobs();
    const allLogs = logManager.getAllLogs();
    
    const jobList = Object.entries(allJobs).map(([id, details]) => {
      const logs = allLogs[id] || {};
      return {
        jobId: id,
        keywords: details.keywords,
        times: details.times,
        createdAt: details.createdAt,
        postedCount: logs.postedBlogs?.filter((b) => b.status === "success").length || 0,
        totalKeywords: details.keywords.length,
      };
    });

    return res.status(200).json({
      message: "Active scheduled posting jobs",
      activeJobs: jobList,
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
      });
    }

    // Stop all cron tasks associated with this job
    for (const { task } of job.scheduledTasks) {
      task.stop();
      task.destroy();
    }

    // Mark as completed in logs
    logManager.markJobCompleted(jobId);

    // Remove job from manager and Supabase
    await jobManager.removeJob(jobId);

    console.log(`Stopped scheduled posting job: ${jobId}`);

    return res.status(200).json({
      message: "Scheduled posting job stopped successfully. Published blogs are archived and preserved in Supabase.",
      jobId,
      keywords: job.keywords,
      times: job.times,
      blogsPreserved: true,
      note: "All blogs that were posted are saved in the published_blogs table and will not be deleted."
    });
  } catch (error) {
    console.error("Error stopping scheduled posting job:", error);
    return res.status(500).json({ error: "Failed to stop scheduled posting job", details: error.message });
  }
}
