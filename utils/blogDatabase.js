import { supabase } from "./supabaseClient.js";

/**
 * Database operations for tracking published blogs and their keywords
 */
export const blogDatabase = {
  // Add a published blog record
  async addPublishedBlog(jobId, keyword, blogData) {
    try {
      const { data, error } = await supabase.from("published_blogs").insert([
        {
          job_id: jobId,
          keyword: keyword,
          title: blogData.title || "",
          slug: blogData.slug || "",
          image_url: blogData.imageUrl || "",
          meta_description: blogData.metaDescription || "",
          content_preview: blogData.intro || "",
          shopify_post_id: blogData.shopifyPostId || null,
          generated_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error("Error adding published blog:", error);
        throw error;
      }

      console.log(`Blog record added for keyword: ${keyword}`);
      return data;
    } catch (error) {
      console.error("Failed to add published blog record:", error);
      throw error;
    }
  },

  // Check if a blog was already generated for this keyword (avoid duplicates)
  async checkDuplicateKeyword(keyword) {
    try {
      const { data, error } = await supabase
        .from("published_blogs")
        .select("id")
        .eq("keyword", keyword.toLowerCase())
        .limit(1);

      if (error) {
        console.error("Error checking for duplicate keyword:", error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error("Failed to check duplicate:", error);
      return false;
    }
  },

  // Check if a blog title already exists (semantic duplicate)
  async checkDuplicateTitle(title) {
    try {
      const { data, error } = await supabase
        .from("published_blogs")
        .select("id")
        .eq("title", title)
        .limit(1);

      if (error) {
        console.error("Error checking for duplicate title:", error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error("Failed to check duplicate title:", error);
      return false;
    }
  },

  // Get all used keywords for a job
  async getUsedKeywords(jobId) {
    try {
      const { data, error } = await supabase
        .from("published_blogs")
        .select("keyword")
        .eq("job_id", jobId);

      if (error) {
        console.error("Error fetching used keywords:", error);
        return [];
      }

      return data ? data.map((row) => row.keyword) : [];
    } catch (error) {
      console.error("Failed to fetch used keywords:", error);
      return [];
    }
  },

  // Get all published blogs for a job
  async getJobBlogs(jobId) {
    try {
      const { data, error } = await supabase
        .from("published_blogs")
        .select("*")
        .eq("job_id", jobId)
        .order("generated_at", { ascending: false });

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

  // Get total blog count for a job
  async getJobBlogCount(jobId) {
    try {
      const { count, error } = await supabase
        .from("published_blogs")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId);

      if (error) {
        console.error("Error counting blogs:", error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error("Failed to count blogs:", error);
      return 0;
    }
  },
};
