import { jobDatabase } from "./supabaseClient.js";

// Global job manager to store scheduled posting jobs
// This maintains scheduled jobs across API requests AND persists to Supabase

let scheduledJobs = {};

export const jobManager = {
  // Store a scheduled job and persist to Supabase
  async addJob(id, jobDetails) {
    try {
      scheduledJobs[id] = jobDetails;
      
      // Persist to Supabase
      await jobDatabase.addJob(id, jobDetails);
      
      console.log(`Job ${id} added. Active jobs:`, Object.keys(scheduledJobs));
      return true;
    } catch (error) {
      console.error(`Failed to add job ${id}:`, error);
      // Keep in memory even if Supabase fails
      return true;
    }
  },

  // Get a specific job
  getJob: (id) => {
    return scheduledJobs[id];
  },

  // Get all jobs
  getAllJobs: () => {
    return scheduledJobs;
  },

  // Remove a job and delete from Supabase
  async removeJob(id) {
    try {
      if (scheduledJobs[id]) {
        delete scheduledJobs[id];
        
        // Remove from Supabase
        await jobDatabase.removeJob(id);
        
        console.log(`Job ${id} removed. Active jobs:`, Object.keys(scheduledJobs));
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to remove job ${id}:`, error);
      return false;
    }
  },

  // Check if a job exists
  jobExists: (id) => {
    return !!scheduledJobs[id];
  },

  // Clear all jobs
  async clearAllJobs() {
    try {
      scheduledJobs = {};
      await jobDatabase.clearAllJobs();
      console.log("All jobs cleared");
      return true;
    } catch (error) {
      console.error("Failed to clear jobs:", error);
      return false;
    }
  },

  // Load jobs from Supabase (called on server startup)
  async loadJobsFromDatabase() {
    try {
      const jobs = await jobDatabase.getAllJobs();
      
      // Convert database format to job format
      for (const job of jobs) {
        scheduledJobs[job.id] = {
          keywords: job.keywords,
          times: job.times,
          shopifyShop: job.shopify_shop,
          shopifyBlogId: job.shopify_blog_id,
          shopifyToken: job.shopify_token,
          createdAt: job.created_at,
          scheduledTasks: [], // Empty array - will be repopulated when job is restarted
        };
      }
      
      console.log(`Loaded ${Object.keys(scheduledJobs).length} jobs from Supabase on startup`);
      return scheduledJobs;
    } catch (error) {
      console.error("Failed to load jobs from database:", error);
      return {};
    }
  },

  // Get jobs that need to be restarted (for server startup scenario)
  getJobsNeedingRestart() {
    return Object.entries(scheduledJobs)
      .filter(([id, job]) => job.scheduledTasks && job.scheduledTasks.length === 0)
      .map(([id, job]) => ({ id, ...job }));
  }
};
