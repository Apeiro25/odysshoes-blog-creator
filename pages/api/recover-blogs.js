import { supabase } from "../../utils/supabaseClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { blogs, jobId } = req.body;

  if (!blogs || !Array.isArray(blogs) || !jobId) {
    return res.status(400).json({
      error: "Required fields: blogs (array) and jobId (string)",
    });
  }

  try {
    console.log(`[RECOVERY] Inserting ${blogs.length} blogs for job ${jobId}...`);

    // Transform logs format to published_blogs format
    const blogRecords = blogs
      .filter((blog) => blog.status === "success")
      .map((blog) => ({
        job_id: jobId,
        keyword: blog.keyword,
        title: blog.data?.title || blog.keyword,
        slug: blog.data?.slug || "",
        image_url: blog.data?.imageUrl || "",
        meta_description: blog.data?.metaDescription || "",
        content_preview: blog.data?.intro || "",
        shopify_post_id: blog.data?.shopifyPostId || null,
        generated_at: blog.timestamp || new Date().toISOString(),
      }));

    console.log(`[RECOVERY] Preparing to insert ${blogRecords.length} records...`);

    // Insert in batches to avoid issues
    const batchSize = 10;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < blogRecords.length; i += batchSize) {
      const batch = blogRecords.slice(i, i + batchSize);

      const { data, error } = await supabase
        .from("published_blogs")
        .insert(batch)
        .select();

      if (error) {
        if (error.code === "23505") {
          // Duplicate key - already exists
          console.warn(
            `[RECOVERY] Batch ${i / batchSize + 1}: Duplicate entries (already exist)`
          );
          skipped += batch.length;
        } else {
          console.error(`[RECOVERY] Error inserting batch ${i / batchSize + 1}:`, error);
          throw error;
        }
      } else {
        inserted += data.length;
        console.log(
          `[RECOVERY] Batch ${i / batchSize + 1}: Inserted ${data.length} blogs`
        );
      }
    }

    console.log(
      `[RECOVERY] Complete: ${inserted} inserted, ${skipped} skipped (duplicates)`
    );

    return res.status(200).json({
      message: "Blog recovery complete",
      jobId,
      inserted,
      skipped,
      total: blogs.length,
    });
  } catch (error) {
    console.error("[RECOVERY] Error recovering blogs:", error);
    return res.status(500).json({
      error: "Failed to recover blogs",
      details: error.message,
    });
  }
}
