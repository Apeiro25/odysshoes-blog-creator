// Global job manager to store scheduled posting jobs
// This maintains scheduled jobs across API requests in the same process

let scheduledJobs = {};

export const jobManager = {
  // Store a scheduled job
  addJob: (id, jobDetails) => {
    scheduledJobs[id] = jobDetails;
    console.log(`Job ${id} added. Active jobs:`, Object.keys(scheduledJobs));
  },

  // Get a specific job
  getJob: (id) => {
    return scheduledJobs[id];
  },

  // Get all jobs
  getAllJobs: () => {
    return scheduledJobs;
  },

  // Remove a job
  removeJob: (id) => {
    if (scheduledJobs[id]) {
      delete scheduledJobs[id];
      console.log(`Job ${id} removed. Active jobs:`, Object.keys(scheduledJobs));
      return true;
    }
    return false;
  },

  // Check if a job exists
  jobExists: (id) => {
    return !!scheduledJobs[id];
  },

  // Clear all jobs
  clearAllJobs: () => {
    scheduledJobs = {};
    console.log("All jobs cleared");
  }
};
