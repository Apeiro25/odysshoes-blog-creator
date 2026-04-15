import { blogDatabase } from "../../utils/blogDatabase.js";
import { supabase } from "../../utils/supabaseClient.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { jobId } = req.query;

  try {
    if (jobId) {
      // Get blogs for a specific job
      const blogs = await blogDatabase.getJobBlogs(jobId);
      const jobData = await supabase
        .from("scheduled_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      return res.status(200).json({
        message: `Published blogs for job: ${jobId}`,
        jobId,
        jobStatus: jobData.data?.status || "active",
        totalBlogs: blogs.length,
        blogs: blogs.map((blog) => ({
          id: blog.id,
          keyword: blog.keyword,
          title: blog.title,
          slug: blog.slug,
          imageUrl: blog.image_url,
          metaDescription: blog.meta_description,
          contentPreview: blog.content_preview,
          shopifyPostId: blog.shopify_post_id,
          generatedAt: blog.generated_at,
        })),
      });
    } else {
      // Get all published blogs across all jobs
      const { data: allBlogs, error } = await supabase
        .from("published_blogs")
        .select("*")
        .order("generated_at", { ascending: false });

      if (error) {
        console.error("Error fetching blogs:", error);
        return res.status(500).json({ error: "Failed to fetch blogs" });
      }

      // Group by jobId
      const groupedByJob = {};
      allBlogs.forEach((blog) => {
        if (!groupedByJob[blog.job_id]) {
          groupedByJob[blog.job_id] = [];
        }
        groupedByJob[blog.job_id].push({
          id: blog.id,
          keyword: blog.keyword,
          title: blog.title,
          slug: blog.slug,
          imageUrl: blog.image_url,
          metaDescription: blog.meta_description,
          contentPreview: blog.content_preview,
          shopifyPostId: blog.shopify_post_id,
          generatedAt: blog.generated_at,
        });
      });

      return res.status(200).json({
        message: "All published blogs across all jobs",
        totalJobs: Object.keys(groupedByJob).length,
        totalBlogs: allBlogs.length,
        blogsByJob: groupedByJob,
      });
    }
  } catch (error) {
    console.error("Error fetching published blogs:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch published blogs", details: error.message });
  }
}
