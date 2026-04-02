import { jobManager } from "../../utils/jobManager.js";
import { logManager } from "../../utils/logManager.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use POST or GET." });
  }

  const { action } = req.query;

  // GET: Show all job history and active jobs
  if (req.method === "GET") {
    try {
      const activeJobs = jobManager.getAllJobs();
      const allLogs = logManager.getAllLogs();

      return res.status(200).json({
        activeJobs: Object.keys(activeJobs),
        jobHistory: Object.entries(allLogs).map(([id, logs]) => ({
          jobId: id,
          status: logs.status || "unknown",
          createdAt: logs.createdAt,
          completedAt: logs.completedAt || null,
          totalPosts: logs.postedBlogs?.length || 0,
        })),
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to retrieve job info", details: error.message });
    }
  }

  // POST: Handle actions on jobs
  const { jobId, force } = req.body;

  if (!action) {
    return res.status(400).json({ error: "Action parameter is required (e.g., ?action=cleanup)" });
  }

  try {
    if (action === "cleanup") {
      // Force cleanup of a job (removes from logs even if not in memory)
      if (jobId) {
        logManager.clearJobLogs(jobId);
        jobManager.removeJob(jobId);
        return res.status(200).json({
          message: `Job ${jobId} cleaned up successfully`,
          jobId,
        });
      } else {
        return res.status(400).json({ error: "jobId is required for cleanup action" });
      }
    }

    if (action === "cleanup-all") {
      // Clear all stuck jobs from logs (but only if they're not in memory)
      const activeJobs = jobManager.getAllJobs();
      const allLogs = logManager.getAllLogs();
      let cleanedCount = 0;

      for (const jobId of Object.keys(allLogs)) {
        if (!activeJobs[jobId]) {
          logManager.clearJobLogs(jobId);
          cleanedCount++;
        }
      }

      return res.status(200).json({
        message: `Cleaned up ${cleanedCount} old job logs`,
        cleanedCount,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    return res.status(500).json({ error: "Failed to perform cleanup", details: error.message });
  }
}
