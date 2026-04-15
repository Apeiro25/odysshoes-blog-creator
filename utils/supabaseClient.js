import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables");
}

// Create a single supabase client for use in the app
export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Database operations for scheduled jobs
 */
export const jobDatabase = {
  // Add a new job to the database
  async addJob(jobId, jobData) {
    try {
      const { data, error } = await supabase.from("scheduled_jobs").insert([
        {
          id: jobId,
          keywords: jobData.keywords,
          times: jobData.times,
          shopify_shop: jobData.shopifyShop,
          shopify_blog_id: jobData.shopifyBlogId,
          shopify_token: jobData.shopifyToken,
        },
      ]);

      if (error) {
        console.error("Error adding job to database:", error);
        throw error;
      }

      console.log(`Job ${jobId} added to Supabase`);
      return data;
    } catch (error) {
      console.error("Failed to add job to database:", error);
      throw error;
    }
  },

  // Get a specific job by ID
  async getJob(jobId) {
    try {
      const { data, error } = await supabase
        .from("scheduled_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows found (expected)
        console.error("Error fetching job:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Failed to fetch job:", error);
      return null;
    }
  },

  // Get all jobs
  async getAllJobs() {
    try {
      const { data, error } = await supabase
        .from("scheduled_jobs")
        .select("*");

      if (error) {
        console.error("Error fetching all jobs:", error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Failed to fetch all jobs:", error);
      return [];
    }
  },

  // Delete a job by ID
  async removeJob(jobId) {
    try {
      const { error } = await supabase
        .from("scheduled_jobs")
        .delete()
        .eq("id", jobId);

      if (error) {
        console.error("Error removing job:", error);
        throw error;
      }

      console.log(`Job ${jobId} removed from Supabase`);
      return true;
    } catch (error) {
      console.error("Failed to remove job:", error);
      return false;
    }
  },

  // Update job (for future use if needed)
  async updateJob(jobId, updates) {
    try {
      const { data, error } = await supabase
        .from("scheduled_jobs")
        .update(updates)
        .eq("id", jobId);

      if (error) {
        console.error("Error updating job:", error);
        throw error;
      }

      console.log(`Job ${jobId} updated in Supabase`);
      return data;
    } catch (error) {
      console.error("Failed to update job:", error);
      throw error;
    }
  },

  // Check if job exists
  async jobExists(jobId) {
    try {
      const job = await this.getJob(jobId);
      return !!job;
    } catch (error) {
      return false;
    }
  },

  // Archive a job (mark as stopped, keep data for download)
  async archiveJob(jobId, stoppedAt = new Date().toISOString()) {
    try {
      const { data, error } = await supabase
        .from("scheduled_jobs")
        .update({
          status: "archived",
          stopped_at: stoppedAt,
        })
        .eq("id", jobId)
        .select();

      if (error) {
        console.error("Error archiving job:", error);
        throw error;
      }

      console.log(`Job ${jobId} archived in Supabase (data preserved for download)`);
      return data;
    } catch (error) {
      console.error("Failed to archive job:", error);
      throw error;
    }
  },

  // Permanently delete an archived job (after user downloads)
  async deleteArchivedJob(jobId) {
    try {
      const { error } = await supabase
        .from("scheduled_jobs")
        .delete()
        .eq("id", jobId);

      if (error) {
        console.error("Error deleting archived job:", error);
        throw error;
      }

      console.log(`Archived job ${jobId} permanently deleted from Supabase`);
      return true;
    } catch (error) {
      console.error("Failed to delete archived job:", error);
      return false;
    }
  },

  // Get all archived jobs
  async getArchivedJobs() {
    try {
      const { data, error } = await supabase
        .from("scheduled_jobs")
        .select("*")
        .eq("status", "archived")
        .order("stopped_at", { ascending: false });

      if (error) {
        console.error("Error fetching archived jobs:", error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Failed to fetch archived jobs:", error);
      return [];
    }
  },

  // Clear all jobs
  async clearAllJobs() {
    try {
      const { error } = await supabase
        .from("scheduled_jobs")
        .delete()
        .neq("id", ""); // Delete all rows where id is not empty

      if (error) {
        console.error("Error clearing jobs:", error);
        throw error;
      }

      console.log("All jobs cleared from Supabase");
      return true;
    } catch (error) {
      console.error("Failed to clear jobs:", error);
      return false;
    }
  },
};
