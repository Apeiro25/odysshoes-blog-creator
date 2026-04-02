import { jobManager } from "../../utils/jobManager.js";
import { logManager } from "../../utils/logManager.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { jobId } = req.query;

  if (!jobId) {
    // Return logs for all jobs
    const allLogs = logManager.getAllLogs();
    const allJobs = jobManager.getAllJobs();

    const response = Object.entries(allLogs).map(([id, logs]) => {
      const job = allJobs[id];
      const postedKeywords = logManager.getPostedKeywords(id);
      const keywords = job?.keywords || [];
      const allPosted = keywords.length > 0 && keywords.every((kw) => postedKeywords.includes(kw));

      return {
        jobId: id,
        keywords,
        times: job?.times || [],
        createdAt: logs.createdAt,
        completedAt: logs.completedAt || null,
        status: logs.status || "running",
        postedBlogs: logs.postedBlogs || [],
        summary: {
          totalKeywords: keywords.length,
          successfulPosts: logs.postedBlogs?.filter((b) => b.status === "success").length || 0,
          failedPosts: logs.postedBlogs?.filter((b) => b.status === "failed").length || 0,
          keywordsCovered: postedKeywords,
          allKeywordsPosted: allPosted,
        },
      };
    });

    return res.status(200).json({
      message: "All job logs",
      logs: response,
    });
  }

  // Return logs for specific job
  try {
    const jobLogs = logManager.getJobLogs(jobId);
    const job = jobManager.getJob(jobId);

    if (!jobLogs) {
      return res.status(404).json({ error: `No logs found for job: ${jobId}` });
    }

    const postedKeywords = logManager.getPostedKeywords(jobId);
    const keywords = job?.keywords || [];
    const allPosted = keywords.length > 0 && keywords.every((kw) => postedKeywords.includes(kw));

    return res.status(200).json({
      jobId,
      keywords,
      times: job?.times || [],
      createdAt: jobLogs.createdAt,
      completedAt: jobLogs.completedAt || null,
      status: jobLogs.status || "running",
      postedBlogs: jobLogs.postedBlogs || [],
      summary: {
        totalKeywords: keywords.length,
        successfulPosts: jobLogs.postedBlogs?.filter((b) => b.status === "success").length || 0,
        failedPosts: jobLogs.postedBlogs?.filter((b) => b.status === "failed").length || 0,
        keywordsCovered: postedKeywords,
        allKeywordsPosted: allPosted,
        percentageComplete: keywords.length > 0 ? Math.round((postedKeywords.length / keywords.length) * 100) : 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to retrieve job logs", details: error.message });
  }
}
