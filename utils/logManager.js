import fs from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");
const JOBS_LOG_FILE = path.join(LOG_DIR, "jobs-log.json");

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize empty log file if it doesn't exist
if (!fs.existsSync(JOBS_LOG_FILE)) {
  fs.writeFileSync(JOBS_LOG_FILE, JSON.stringify({}), "utf8");
}

export const logManager = {
  // Add a blog post to the log
  addBlogLog: (jobId, keyword, status, details = {}) => {
    try {
      const logs = JSON.parse(fs.readFileSync(JOBS_LOG_FILE, "utf8"));

      if (!logs[jobId]) {
        logs[jobId] = {
          createdAt: new Date().toISOString(),
          statusHistory: [],
          postedBlogs: [],
        };
      }

      logs[jobId].postedBlogs.push({
        keyword,
        status, // 'success' or 'failed'
        timestamp: new Date().toISOString(),
        ...details,
      });

      fs.writeFileSync(JOBS_LOG_FILE, JSON.stringify(logs, null, 2), "utf8");
      console.log(`Logged blog post for job ${jobId}: ${keyword} (${status})`);
    } catch (error) {
      console.error("Error logging blog:", error);
    }
  },

  // Get logs for a specific job
  getJobLogs: (jobId) => {
    try {
      const logs = JSON.parse(fs.readFileSync(JOBS_LOG_FILE, "utf8"));
      return logs[jobId] || null;
    } catch (error) {
      console.error("Error reading job logs:", error);
      return null;
    }
  },

  // Get all posted keywords for a job
  getPostedKeywords: (jobId) => {
    try {
      const logs = JSON.parse(fs.readFileSync(JOBS_LOG_FILE, "utf8"));
      if (logs[jobId]) {
        return logs[jobId].postedBlogs
          .filter((blog) => blog.status === "success")
          .map((blog) => blog.keyword);
      }
      return [];
    } catch (error) {
      console.error("Error getting posted keywords:", error);
      return [];
    }
  },

  // Mark job as completed
  markJobCompleted: (jobId) => {
    try {
      const logs = JSON.parse(fs.readFileSync(JOBS_LOG_FILE, "utf8"));
      if (logs[jobId]) {
        logs[jobId].completedAt = new Date().toISOString();
        logs[jobId].status = "completed";
      }
      fs.writeFileSync(JOBS_LOG_FILE, JSON.stringify(logs, null, 2), "utf8");
      console.log(`Job ${jobId} marked as completed`);
    } catch (error) {
      console.error("Error marking job as completed:", error);
    }
  },

  // Clear logs for a specific job
  clearJobLogs: (jobId) => {
    try {
      const logs = JSON.parse(fs.readFileSync(JOBS_LOG_FILE, "utf8"));
      delete logs[jobId];
      fs.writeFileSync(JOBS_LOG_FILE, JSON.stringify(logs, null, 2), "utf8");
      console.log(`Cleared logs for job ${jobId}`);
    } catch (error) {
      console.error("Error clearing job logs:", error);
    }
  },

  // Get all logs
  getAllLogs: () => {
    try {
      return JSON.parse(fs.readFileSync(JOBS_LOG_FILE, "utf8"));
    } catch (error) {
      console.error("Error reading all logs:", error);
      return {};
    }
  },
};
