import { jobManager } from "../../utils/jobManager.js";

export default async function handler(req, res) {
  // Allow both POST and GET requests for flexibility
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use POST or GET." });
  }

  const { jobId } = req.method === "POST" ? req.body : req.query;

  // If no jobId provided, show available jobs
  if (!jobId) {
    const allJobs = jobManager.getAllJobs();
    const jobList = Object.entries(allJobs).map(([id, details]) => ({
      jobId: id,
      keywords: details.keywords,
      times: details.times,
      createdAt: details.createdAt,
    }));

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
      return res.status(404).json({ error: `Job not found: ${jobId}` });
    }

    // Stop all cron tasks associated with this job
    for (const { task } of job.scheduledTasks) {
      task.stop();
      task.destroy();
    }

    // Remove job from manager
    jobManager.removeJob(jobId);

    console.log(`Stopped scheduled posting job: ${jobId}`);

    return res.status(200).json({
      message: "Scheduled posting job stopped successfully",
      jobId,
      keywords: job.keywords,
      times: job.times,
    });
  } catch (error) {
    console.error("Error stopping scheduled posting job:", error);
    return res.status(500).json({ error: "Failed to stop scheduled posting job", details: error.message });
  }
}
