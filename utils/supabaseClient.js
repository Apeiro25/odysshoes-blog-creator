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

/**
 * Database operations for published blogs
 */
export const publishedBlogsDatabase = {
  // Add a published blog to the database
  async addPublishedBlog(jobId, keyword, metadata = {}) {
    try {
      const { data, error } = await supabase.from("published_blogs").insert([
        {
          job_id: jobId,
          keyword: keyword,
          title: metadata.title || "",
          slug: metadata.slug || "",
          image_url: metadata.imageUrl || null,
          meta_description: metadata.metaDescription || "",
          content_preview: metadata.contentPreview || "",
          shopify_post_id: metadata.shopifyPostId || null,
          posted_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error("Error adding published blog to database:", error);
        // Don't throw - allow system to continue even if logging fails
        return null;
      }

      console.log(`Published blog "${keyword}" added to Supabase`);
      return data;
    } catch (error) {
      console.error("Failed to add published blog to database:", error);
      // Return null instead of throwing to prevent job failures
      return null;
    }
  },

  // Get all used keywords from published blogs
  async getUsedKeywords() {
    try {
      const { data, error } = await supabase
        .from("published_blogs")
        .select("keyword");

      if (error) {
        console.error("Error fetching used keywords:", error);
        return [];
      }

      // Extract unique keywords
      const keywords = data?.map(row => row.keyword) || [];
      return [...new Set(keywords)];
    } catch (error) {
      console.error("Failed to fetch used keywords:", error);
      return [];
    }
  },

  // Get a published blog by keyword
  async getBlogByKeyword(keyword) {
    try {
      const { data, error } = await supabase
        .from("published_blogs")
        .select("*")
        .eq("keyword", keyword)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching blog:", error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error("Failed to fetch blog:", error);
      return null;
    }
  },

  // Get all published blogs for a job
  async getBlogsByJobId(jobId) {
    try {
      const { data, error } = await supabase
        .from("published_blogs")
        .select("*")
        .eq("job_id", jobId);

      if (error) {
        console.error("Error fetching job blogs:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Failed to fetch job blogs:", error);
      return [];
    }
  },

  // Get all published blogs
  async getAllPublishedBlogs() {
    try {
      const { data, error } = await supabase
        .from("published_blogs")
        .select("*");

      if (error) {
        console.error("Error fetching all published blogs:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Failed to fetch all published blogs:", error);
      return [];
    }
  },

  // Check if keyword is already published
  async keywordExists(keyword) {
    try {
      const blog = await this.getBlogByKeyword(keyword);
      return !!blog;
    } catch (error) {
      return false;
    }
  },
};
