import fs from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");
const JOBS_LOG_FILE = path.join(LOG_DIR, "jobs-log.json");

// Try to ensure logs directory exists, but handle errors gracefully for serverless
const initializeLogsDirectory = () => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    
    // Initialize empty log file if it doesn't exist
    if (!fs.existsSync(JOBS_LOG_FILE)) {
      fs.writeFileSync(JOBS_LOG_FILE, JSON.stringify({}), "utf8");
    }
  } catch (error) {
    console.warn("Warning: Could not initialize logs directory. Using in-memory logging.", error.message);
    // Fallback: use in-memory logging
  }
};

// In-memory fallback for serverless environments
let inMemoryLogs = {};

// Initialize on module load
initializeLogsDirectory();

const readLogsFile = () => {
  try {
    if (fs.existsSync(JOBS_LOG_FILE)) {
      const data = fs.readFileSync(JOBS_LOG_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn("Error reading logs file, using in-memory logs:", error.message);
  }
  return inMemoryLogs; // Fallback to in-memory
};

const writeLogsFile = (logs) => {
  try {
    if (fs.existsSync(LOG_DIR)) {
      fs.writeFileSync(JOBS_LOG_FILE, JSON.stringify(logs, null, 2), "utf8");
      return true;
    }
  } catch (error) {
    console.warn("Error writing logs file, using in-memory logs:", error.message);
  }
  // Fallback: update in-memory logs
  inMemoryLogs = logs;
  return false;
};

export const logManager = {
  // Add a blog post to the log
  addBlogLog: (jobId, keyword, status, details = {}) => {
    try {
      const logs = readLogsFile();

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

      writeLogsFile(logs);
      console.log(`Logged blog post for job ${jobId}: ${keyword} (${status})`);
    } catch (error) {
      console.error("Error logging blog:", error);
    }
  },

  // Get logs for a specific job
  getJobLogs: (jobId) => {
    try {
      const logs = readLogsFile();
      return logs[jobId] || null;
    } catch (error) {
      console.error("Error reading job logs:", error);
      return null;
    }
  },

  // Get all logs
  getAllLogs: () => {
    try {
      return readLogsFile();
    } catch (error) {
      console.error("Error reading all logs:", error);
      return inMemoryLogs;
    }
  },

  // Get all posted keywords for a job
  getPostedKeywords: (jobId) => {
    try {
      const logs = readLogsFile();
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
      const logs = readLogsFile();
      if (logs[jobId]) {
        logs[jobId].completedAt = new Date().toISOString();
        logs[jobId].status = "completed";
      }
      writeLogsFile(logs);
      console.log(`Job ${jobId} marked as completed`);
    } catch (error) {
      console.error("Error marking job as completed:", error);
    }
  },

  // Clear logs for a specific job
  clearJobLogs: (jobId) => {
    try {
      const logs = readLogsFile();
      delete logs[jobId];
      writeLogsFile(logs);
      console.log(`Cleared logs for job ${jobId}`);
    } catch (error) {
      console.error("Error clearing job logs:", error);
    }
  },
};
