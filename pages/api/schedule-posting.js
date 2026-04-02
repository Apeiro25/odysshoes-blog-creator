import cron from "node-cron";
import { jobManager } from "../../utils/jobManager.js";
import { logManager } from "../../utils/logManager.js";

// Function to generate and post blog
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
    
    // Log successful posting
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

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const {
    keywords,
    times = ["08:00", "12:00", "18:00"], // Default: 8 AM, 12 PM, 6 PM
    shopifyToken,
    shopifyShop,
    shopifyBlogId,
  } = req.body;

  // Validate required parameters
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res
      .status(400)
      .json({ error: "Keywords must be a non-empty array (e.g., ['keyword1', 'keyword2'])" });
  }

  if (!times || !Array.isArray(times) || times.length === 0) {
    return res.status(400).json({ error: "Times must be a non-empty array (e.g., ['08:00', '12:00', '18:00'])" });
  }

  // Validate time format (HH:MM)
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  for (const time of times) {
    if (!timeRegex.test(time)) {
      return res.status(400).json({ error: `Invalid time format: ${time}. Use HH:MM (24-hour format).` });
    }
  }

  // Generate unique job ID
  const jobId = `schedule-${Date.now()}`;

  try {
    // Create cron jobs for each specified time
    const scheduledTasks = [];

    for (const time of times) {
      // Parse time (HH:MM)
      const [hours, minutes] = time.split(":").map(Number);

      // Create cron expression: at specified time every day
      const cronExpression = `${minutes} ${hours} * * *`;

      console.log(`Scheduling cron job for time: ${time} (cron: ${cronExpression})`);

      // Schedule task
      const task = cron.schedule(cronExpression, async () => {
        console.log(`[${jobId}] Cron job triggered at ${time}`);

        // Check if all keywords have already been posted
        const postedKeywords = logManager.getPostedKeywords(jobId);
        const allKeywordsPosted = keywords.every((kw) =>
          postedKeywords.includes(kw)
        );

        if (allKeywordsPosted) {
          console.log(
            `[${jobId}] All keywords have been successfully posted. Auto-stopping job...`
          );
          logManager.markJobCompleted(jobId);

          // Stop all tasks
          for (const { task: t } of scheduledTasks) {
            t.stop();
            t.destroy();
          }

          jobManager.removeJob(jobId);
          return;
        }

        // Rotate through keywords, pick those not yet posted
        const keywordsToPick = keywords.filter(
          (kw) => !postedKeywords.includes(kw)
        );
        const selectedKeyword =
          keywordsToPick.length > 0
            ? keywordsToPick[Math.floor(Math.random() * keywordsToPick.length)]
            : keywords[Math.floor(Math.random() * keywords.length)];

        console.log(
          `[${jobId}] Generating blog post for keyword: ${selectedKeyword}`
        );
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

    // Store job info in global job manager
    jobManager.addJob(jobId, {
      keywords,
      times,
      scheduledTasks,
      shopifyShop,
      shopifyBlogId,
      createdAt: new Date().toISOString(),
    });

    console.log(`Scheduled posting job created: ${jobId}`);
    console.log(`Keywords: ${keywords.join(", ")}`);
    console.log(`Times: ${times.join(", ")}`);

    return res.status(201).json({
      message: "Scheduled posting job created successfully",
      jobId,
      keywords,
      times,
      instructions: "Use the job ID to stop this job. Send a POST request to /api/stop-posting with the jobId.",
    });
  } catch (error) {
    console.error("Error creating scheduled posting job:", error);
    return res.status(500).json({ error: "Failed to create scheduled posting job", details: error.message });
  }
}
