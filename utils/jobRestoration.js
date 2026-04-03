import cron from "node-cron";
import { jobManager } from "./jobManager.js";
import { logManager } from "./logManager.js";

let isRestoringJobs = false;

// Function to generate and post blog (copy from schedule-posting.js)
async function generateAndPostBlog(keyword, shopifyShop, shopifyToken, blogId, jobId) {
  try {
    const response = await fetch("http://localhost:3000/api/generate", {
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
      console.log(`[${jobId}] Restored cron job triggered at ${time}`);

      const postedKeywords = logManager.getPostedKeywords(jobId);
      const allKeywordsPosted = keywords.every((kw) =>
        postedKeywords.includes(kw)
      );

      if (allKeywordsPosted) {
        console.log(`[${jobId}] All keywords have been successfully posted. Auto-stopping job...`);
        logManager.markJobCompleted(jobId);

        for (const { task: t } of scheduledTasks) {
          t.stop();
          t.destroy();
        }

        jobManager.removeJob(jobId);
        return;
      }

      const keywordsToPick = keywords.filter(
        (kw) => !postedKeywords.includes(kw)
      );
      const selectedKeyword =
        keywordsToPick.length > 0
          ? keywordsToPick[Math.floor(Math.random() * keywordsToPick.length)]
          : keywords[Math.floor(Math.random() * keywords.length)];

      console.log(`[${jobId}] Generating blog post for keyword: ${selectedKeyword}`);
      await generateAndPostBlog(
        selectedKeyword,
        shopifyShop,
        shopifyToken,
        shopifyBlogId,
        jobId
      );
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
