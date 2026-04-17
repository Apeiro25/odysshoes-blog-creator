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
    // First, try to load jobs from Supabase if memory is empty
    let allJobs = jobManager.getAllJobs();
    if (Object.keys(allJobs).length === 0) {
      console.log('No in-memory jobs found, loading from Supabase...');
      try {
        await jobManager.loadJobsFromDatabase();
        allJobs = jobManager.getAllJobs();
        console.log(`Loaded ${Object.keys(allJobs).length} jobs from Supabase`);
      } catch (error) {
        console.warn('Could not load jobs from Supabase:', error.message);
      }
    }
    
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
      // Job not in memory, but might still be in Supabase - try to remove it anyway
      console.log(`Job ${jobId} not found in memory, attempting to remove from Supabase...`);
      try {
        await jobManager.removeJob(jobId);
        return res.status(200).json({
          message: "Job stopped and removed from Supabase",
          jobId,
          note: "Job was not in memory but has been removed from Supabase to prevent future resumption.",
        });
      } catch (dbError) {
        console.error(`Failed to remove job from Supabase: ${dbError.message}`);
        return res.status(404).json({ 
          error: `Job not found: ${jobId}. Could not remove from Supabase.`,
        });
      }
    }

    // Stop all cron tasks associated with this job
    console.log(`[${jobId}] Stopping ${job.scheduledTasks?.length || 0} cron tasks...`);
    if (job.scheduledTasks && Array.isArray(job.scheduledTasks)) {
      for (const { task, time } of job.scheduledTasks) {
        try {
          if (task) {
            task.stop();
            task.destroy();
            console.log(`[${jobId}] Stopped cron task for time: ${time}`);
          }
        } catch (taskError) {
          console.error(`[${jobId}] Error stopping task for time ${time}:`, taskError.message);
        }
      }
    }

    // Mark as completed in logs
    logManager.markJobCompleted(jobId);

    // Remove job from manager and Supabase
    const removed = await jobManager.removeJob(jobId);
    
    if (!removed) {
      console.warn(`[${jobId}] Warning: Job could not be removed from database, but has been stopped in memory`);
    }

    console.log(`Successfully stopped scheduled posting job: ${jobId}`);

    return res.status(200).json({
      message: "Scheduled posting job stopped successfully and removed from Supabase",
      jobId,
      keywords: job.keywords,
      times: job.times,
      blogsPreserved: true,
      stoppedAt: new Date().toISOString(),
      note: "All blogs that were posted are saved in the published_blogs table and will not be deleted. Job has been removed from Supabase so it will not resume on server restart.",
    });
  } catch (error) {
    console.error("Error stopping scheduled posting job:", error);
    return res.status(500).json({ error: "Failed to stop scheduled posting job", details: error.message });
  }
}
