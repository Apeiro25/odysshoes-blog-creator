import cron from "node-cron";
import { jobManager } from "./jobManager.js";
import { logManager } from "./logManager.js";
import { blogDatabase } from "./blogDatabase.js";
import { generateKeywords } from "./keywordGenerator.js";

let isRestoringJobs = false;

// Function to generate and post blog (copy from schedule-posting.js)
async function generateAndPostBlog(keyword, shopifyShop, shopifyToken, blogId, jobId) {
  try {
    // Determine the API URL based on environment
    const apiUrl =
      process.env.NODE_ENV === "production"
        ? `${process.env.RAILWAY_PUBLIC_DOMAIN || "http://localhost:3000"}/api/generate`
        : "http://localhost:3000/api/generate";

    console.log(`[${jobId}] API URL: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyword,
        author: "Scheduled Bot",
        shopifyToken,
        shopifyShop,
        shopifyBlogId: blogId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to generate blog for keyword: ${keyword}`, errorText);
      logManager.addBlogLog(jobId, keyword, "failed", { error: errorText });
      return false;
    }

    const data = await response.json();
    console.log(`Successfully generated and posted blog for keyword: ${keyword}`);

    // Track the published blog and keyword relationship
    try {
      await blogDatabase.addPublishedBlog(jobId, keyword, {
        title: data.blog?.title || "N/A",
        slug: data.blog?.slug || "",
        imageUrl: data.imageUrl || "N/A",
        metaDescription: data.blog?.metaDescription || "",
        intro: data.blog?.intro || "",
        shopifyPostId: data.shopifyPostId || null,
      });
    } catch (dbError) {
      console.error("Failed to track published blog:", dbError);
      // Don't fail the posting if tracking fails
    }

    logManager.addBlogLog(jobId, keyword, "success", {
      title: data.blog?.title || "N/A",
      imageUrl: data.imageUrl || "N/A",
    });

    return true;
  } catch (error) {
    console.error(`Error generating and posting blog for keyword: ${keyword}`, error);
    logManager.addBlogLog(jobId, keyword, "failed", { error: error.message });
    return false;
  }
}

// Restore a single job's cron tasks
function restoreJobTasks(jobId, jobData) {
  const { keywords, times, shopifyShop, shopifyBlogId, shopifyToken } = jobData;
  const scheduledTasks = [];

  for (const time of times) {
    const [hours, minutes] = time.split(":").map(Number);
    const cronExpression = `${minutes} ${hours} * * *`;

    console.log(`[RESTORATION] Re-scheduling cron job for time: ${time} (cron: ${cronExpression})`);

    const task = cron.schedule(cronExpression, async () => {
      console.log(`[${jobId}] Cron job triggered at ${time}`);

      try {
        // Get current job data
        const currentJob = jobManager.getJob(jobId);
        let currentKeywords = currentJob?.keywords || keywords;

        // Get used keywords from database
        const usedKeywords = await blogDatabase.getUsedKeywords(jobId);
        console.log(`[${jobId}] Already used ${usedKeywords.length} keywords`);

        // Filter out already used keywords
        const availableKeywords = currentKeywords.filter(
          (kw) => !usedKeywords.some((used) => used.toLowerCase() === kw.toLowerCase())
        );

        let selectedKeyword = null;

        if (availableKeywords.length > 0) {
          // Pick from available keywords
          selectedKeyword =
            availableKeywords[Math.floor(Math.random() * availableKeywords.length)];
          console.log(
            `[${jobId}] Selected keyword from pool: ${selectedKeyword} (${availableKeywords.length} remaining)`
          );
        } else {
          // All keywords exhausted - generate new ones
          console.log(`[${jobId}] All keywords exhausted! Auto-generating new keywords...`);

          try {
            const newKeywords = await generateKeywords(
              currentKeywords.slice(0, 5), // Use first 5 as reference
              usedKeywords,
              "shoes", // niche
              10 // generate 10 new keywords
            );

            if (newKeywords && newKeywords.length > 0) {
              // Update job with new keywords
              currentJob.keywords = [...currentKeywords, ...newKeywords];
              jobManager.addJob(jobId, currentJob);

              console.log(`[${jobId}] Generated and added ${newKeywords.length} new keywords`);

              // Pick from new keywords
              selectedKeyword =
                newKeywords[Math.floor(Math.random() * newKeywords.length)];
              console.log(`[${jobId}] Selected keyword from new batch: ${selectedKeyword}`);
            } else {
              // Fallback: pick random from original keywords
              console.warn(`[${jobId}] Failed to generate new keywords, using fallback`);
              selectedKeyword =
                currentKeywords[Math.floor(Math.random() * currentKeywords.length)];
            }
          } catch (genError) {
            console.error(`[${jobId}] Error generating keywords:`, genError);
            // Fallback: pick random from original keywords
            selectedKeyword =
              currentKeywords[Math.floor(Math.random() * currentKeywords.length)];
          }
        }

        if (selectedKeyword) {
          // Check for duplicate keyword posting
          const isDuplicate = await blogDatabase.checkDuplicateKeyword(selectedKeyword);
          if (isDuplicate) {
            console.warn(
              `[${jobId}] Keyword "${selectedKeyword}" already has a published blog, skipping...`
            );
            return;
          }

          console.log(`[${jobId}] Generating blog post for keyword: ${selectedKeyword}`);
          await generateAndPostBlog(
            selectedKeyword,
            shopifyShop,
            shopifyToken,
            shopifyBlogId,
            jobId
          );
        }
      } catch (error) {
        console.error(`[${jobId}] Error in cron task:`, error);
      }
    });

    scheduledTasks.push({ time, task });
  }

  // Update the stored job with the recreated tasks
  const job = jobManager.getJob(jobId);
  if (job) {
    job.scheduledTasks = scheduledTasks;
  }

  return scheduledTasks.length > 0;
}

// Main restoration function
export async function restoreActiveJobs() {
  if (isRestoringJobs) {
    console.log("Job restoration already in progress...");
    return;
  }

  isRestoringJobs = true;
  console.log("\n========== STARTING JOB RESTORATION FROM SUPABASE ==========");

  try {
    // Load jobs from Supabase database
    const loadedJobs = await jobManager.loadJobsFromDatabase();
    const jobsToRestore = jobManager.getJobsNeedingRestart();

    if (jobsToRestore.length === 0) {
      console.log("No jobs to restore.");
      console.log("========== JOB RESTORATION COMPLETE ==========\n");
      isRestoringJobs = false;
      return;
    }

    console.log(`Found ${jobsToRestore.length} jobs to restore on startup...`);

    for (const jobData of jobsToRestore) {
      const { id, shopifyToken } = jobData;
      
      if (!shopifyToken) {
        console.warn(`[RESTORATION] Skipping job ${id}: Missing Shopify token. This needs to be reconfigured.`);
        continue;
      }

      try {
        const restored = restoreJobTasks(id, jobData);
        if (restored) {
          console.log(`[RESTORATION] ✓ Successfully restored job ${id}`);
        }
      } catch (error) {
        console.error(`[RESTORATION] ✗ Failed to restore job ${id}:`, error.message);
      }
    }

    console.log(`========== RESTORED ${jobsToRestore.length} JOBS FROM SUPABASE ==========\n`);
  } catch (error) {
    console.error("ERROR during job restoration:", error);
  } finally {
    isRestoringJobs = false;
  }
}

// Export for manual triggering if needed
export const triggerJobRestoration = async () => {
  return restoreActiveJobs();
};
