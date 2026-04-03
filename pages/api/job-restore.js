import { jobManager } from "../../utils/jobManager.js";
import { logManager } from "../../utils/logManager.js";
import { restoreActiveJobs, triggerJobRestoration } from "../../utils/jobRestoration.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use POST or GET." });
  }

  const { action } = req.query;

  // GET: Check status of jobs that need restoration
  if (req.method === "GET") {
    try {
      const jobsNeedingRestart = jobManager.getJobsNeedingRestart();
      const allJobs = jobManager.getAllJobs();
      const allLogs = logManager.getAllLogs();

      return res.status(200).json({
        status: "ok",
        storage: "Supabase Cloud Database",
        summary: {
          totalActiveJobs: Object.keys(allJobs).length,
          jobsWithRunningTasks: Object.values(allJobs).filter(j => j.scheduledTasks && j.scheduledTasks.length > 0).length,
          jobsNeedingRestart: jobsNeedingRestart.length,
        },
        jobsNeedingRestart: jobsNeedingRestart.map(job => ({
          jobId: job.id,
          keywords: job.keywords,
          times: job.times,
          createdAt: job.createdAt,
        })),
        allActiveJobs: Object.entries(allJobs).map(([id, job]) => ({
          jobId: id,
          keywords: job.keywords,
          times: job.times,
          hasActiveTasks: job.scheduledTasks && job.scheduledTasks.length > 0,
          createdAt: job.createdAt,
        })),
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to check job status", details: error.message });
    }
  }

  // POST: Trigger restoration
  if (req.method === "POST") {
    if (!action) {
      return res.status(400).json({ error: "Action parameter is required (e.g., ?action=restore)" });
    }

    try {
      if (action === "restore") {
        console.log("Manual job restoration triggered via API");
        
        // Load jobs from Supabase
        await jobManager.loadJobsFromDatabase();
        
        // Restore cron tasks
        await triggerJobRestoration();

        const jobsNeedingRestart = jobManager.getJobsNeedingRestart();
        const allJobs = jobManager.getAllJobs();

        return res.status(200).json({
          message: "Job restoration completed",
          storage: "Supabase Cloud Database",
          summary: {
            totalActiveJobs: Object.keys(allJobs).length,
            jobsWithRunningTasks: Object.values(allJobs).filter(j => j.scheduledTasks && j.scheduledTasks.length > 0).length,
            jobsStillNeedingRestart: jobsNeedingRestart.length,
          },
          details: Object.entries(allJobs).map(([id, job]) => ({
            jobId: id,
            keywords: job.keywords,
            times: job.times,
            hasActiveTasks: job.scheduledTasks && job.scheduledTasks.length > 0,
            createdAt: job.createdAt,
          })),
        });
      }

      if (action === "clear-memory") {
        // Clear only in-memory jobs (not the database)
        await jobManager.clearAllJobs();
        return res.status(200).json({
          message: "All in-memory jobs cleared",
          note: "Jobs in Supabase database still exist. They will be restored on next server restart.",
        });
      }

      return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (error) {
      console.error("Error during job restoration:", error);
      return res.status(500).json({ error: "Failed to restore jobs", details: error.message });
    }
  }
}
