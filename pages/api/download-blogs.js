import { blogDatabase } from "../../utils/blogDatabase.js";
import { supabase } from "../../utils/supabaseClient.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { jobId, format = "json" } = req.query;

  try {
    if (!jobId) {
      return res.status(400).json({ error: "jobId is required" });
    }

    // Get job data
    const jobData = await supabase
      .from("scheduled_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (!jobData.data) {
      return res.status(404).json({ error: `Job not found: ${jobId}` });
    }

    // Get all blogs for this job
    const blogs = await blogDatabase.getJobBlogs(jobId);

    const exportData = {
      jobId: jobId,
      jobDetails: {
        keywords: jobData.data.keywords,
        times: jobData.data.times,
        shopifyShop: jobData.data.shopify_shop,
        shopifyBlogId: jobData.data.shopify_blog_id,
        createdAt: jobData.data.created_at,
        updatedAt: jobData.data.updated_at,
        status: jobData.data.status || "active",
      },
      exportedAt: new Date().toISOString(),
      totalBlogs: blogs.length,
      blogs: blogs.map((blog) => ({
        keyword: blog.keyword,
        title: blog.title,
        slug: blog.slug,
        imageUrl: blog.image_url,
        metaDescription: blog.meta_description,
        contentPreview: blog.content_preview,
        shopifyPostId: blog.shopify_post_id,
        generatedAt: blog.generated_at,
      })),
    };

    if (format === "csv") {
      // Convert to CSV
      const headers = [
        "Keyword",
        "Title",
        "Slug",
        "Meta Description",
        "Shopify Post ID",
        "Generated At",
      ];
      const rows = blogs.map((blog) => [
        blog.keyword,
        `"${blog.title.replace(/"/g, '""')}"`, // Escape quotes in CSV
        blog.slug,
        `"${(blog.meta_description || "").replace(/"/g, '""')}"`,
        blog.shopify_post_id || "",
        blog.generated_at,
      ]);

      const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
        "\n"
      );

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${jobId}_blogs.csv"`);
      return res.status(200).send(csv);
    }

    // Default: JSON format
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${jobId}_blogs.json"`);
    return res.status(200).json(exportData);
  } catch (error) {
    console.error("Error downloading blogs:", error);
    return res
      .status(500)
      .json({ error: "Failed to download blogs", details: error.message });
  }
}
