import cron from "node-cron";
import { jobManager } from "../../utils/jobManager.js";
import { logManager } from "../../utils/logManager.js";
import { restoreActiveJobs } from "../../utils/jobRestoration.js";
import { publishedBlogsDatabase } from "../../utils/supabaseClient.js";
import { generateKeywords } from "../../utils/keywordGenerator.js";
import { checkForDuplicates } from "../../utils/duplicateChecker.js";
import { fetchPublishedBlogs } from "../../utils/odysshoesBlogFetcher.js";

// Philippines timezone offset (UTC+8)
const PHT_OFFSET = 8;

// Get current server timezone offset (in hours)
function getServerTimezoneOffsetHours() {
  const now = new Date();
  // getTimezoneOffset returns minutes, negative for UTC+ zones
  // We negate it and divide by 60 to get hours (positive for UTC+ zones)
  return -now.getTimezoneOffset() / 60;
}

// Convert Philippines time to server local time
function convertPHTToServerTime(phtHours, phtMinutes) {
  // Step 1: Create a UTC date at the PHT input time minus 8 hours
  const now = new Date();
  const utcTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), phtHours - PHT_OFFSET, phtMinutes, 0);
  
  // Step 2: Create a regular Date object (which converts to server local time)
  const localDate = new Date(utcTime);
  
  return {
    hours: localDate.getHours(),
    minutes: localDate.getMinutes(),
  };
}

// Flag to track if restoration has been attempted
let hasAttemptedRestoration = false;

// Function to generate and post blog
async function generateAndPostBlog(keyword, shopifyShop, shopifyToken, blogId, jobId) {
  try {
    // Check for duplicates before generating
    console.log(`Checking for duplicates for keyword: "${keyword}"...`);
    const duplicateCheck = await checkForDuplicates(keyword);
    
    console.log(`Duplicate Check Result:`, duplicateCheck);
    
    if (duplicateCheck.isDuplicate) {
      console.warn(`⛔ SKIPPING - ${duplicateCheck.recommendation}`);
      duplicateCheck.warnings.forEach(w => console.warn(w));
      logManager.addBlogLog(jobId, keyword, "skipped", {
        reason: "Duplicate keyword detected",
        duplicateReport: duplicateCheck,
      });
      return false;
    }
    
    // Also check odysshoes.com for duplicates
    console.log(`Checking odysshoes.com for duplicate keyword: "${keyword}"...`);
    const publishedOdysshoeBlogs = await fetchPublishedBlogs();
    const keywordExists = publishedOdysshoeBlogs.some(blog => 
      blog.title.toLowerCase().includes(keyword.toLowerCase()) ||
      blog.slug.toLowerCase().includes(keyword.toLowerCase().replace(/\s+/g, '-'))
    );
    
    if (keywordExists) {
      console.warn(`⛔ SKIPPING - Keyword already published on odysshoes.com`);
      logManager.addBlogLog(jobId, keyword, "skipped", {
        reason: "Keyword already exists on odysshoes.com/blogs/news",
        odysshoesCheck: true,
      });
      return false;
    }
    
    if (duplicateCheck.recommendation === "CAUTION - Very similar content exists" || 
        duplicateCheck.recommendation === "CAUTION - Very similar blog already published") {
      console.warn(`⚠️ WARNING - ${duplicateCheck.recommendation}`);
      duplicateCheck.warnings.forEach(w => console.warn(w));
      // Still proceed but log the warning
    }
    
    const response = await fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyword,
        author: "Jhon Paul Arinzol",
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
    
    // Log successful posting to published_blogs table
    try {
      await publishedBlogsDatabase.addPublishedBlog(jobId, keyword, {
        title: data.blog?.title || "N/A",
        slug: data.blog?.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "untitled",
        imageUrl: data.shopifyResponse?.article?.image?.src || null,
        metaDescription: data.blog?.metaDescription || "N/A",
        contentPreview: data.blog?.intro || data.blog?.mainContent?.[0]?.content?.[0]?.text || "N/A",
        shopifyPostId: data.shopifyResponse?.article?.id || null,
      });
      console.log(`✓ Logged to published_blogs: ${keyword}`);
    } catch (dbError) {
      console.warn(`Could not log to database: ${dbError.message}`);
      // Don't fail the overall operation if logging fails
    }
    
    // Log successful posting with odysshoes linking info
    logManager.addBlogLog(jobId, keyword, "success", {
      title: data.blog?.title || "N/A",
      imageUrl: data.shopifyResponse?.article?.image?.src || "N/A",
      shopifyPostId: data.shopifyResponse?.article?.id,
      linkedOdysshoeBlogs: data.odysshoesIntegration?.linkedBlogs || [],
      linkedBlogsCount: data.odysshoesIntegration?.linkedBlogsCount || 0,
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

  // Attempt to restore jobs on first API call (fallback if custom server wasn't used)
  if (!hasAttemptedRestoration) {
    hasAttemptedRestoration = true;
    try {
      console.log("Attempting to restore active jobs from disk...");
      await restoreActiveJobs();
    } catch (error) {
      console.warn("Failed to restore jobs, continuing:", error.message);
      // Don't fail the request, just log the warning
    }
  }

  const {
    keywords: providedKeywords,
    times = ["06:00", "09:00", "12:00", "15:00", "18:00"], // Default: 6 AM, 9 AM, 12 PM, 3 PM, 6 PM
    shopifyToken,
    shopifyShop,
    shopifyBlogId,
  } = req.body;

  let keywords = providedKeywords;

  // Auto-generate keywords if not provided
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    try {
      console.log("Keywords not provided. Auto-generating keywords...");
      
      // Get already published keywords to avoid duplicates
      const usedKeywords = await publishedBlogsDatabase.getUsedKeywords();
      console.log(`Avoiding ${usedKeywords.length} already-published keywords`);
      
      // Generate new keywords
      const generatedKeywords = await generateKeywords(
        ["custom shoes", "personalized shoes", "handmade shoes"],
        usedKeywords,
        "shoes and customization",
        20 // Generate 20 keywords to start with
      );
      
      if (!generatedKeywords || generatedKeywords.length === 0) {
        return res.status(500).json({ error: "Failed to auto-generate keywords" });
      }
      
      keywords = generatedKeywords;
      console.log(`✓ Auto-generated ${keywords.length} keywords`);
    } catch (error) {
      console.error("Error auto-generating keywords:", error);
      return res.status(500).json({ error: "Failed to auto-generate keywords", details: error.message });
    }
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
    // Fetch published blogs from odysshoes.com for linking information
    console.log('🌐 Fetching odysshoes.com/blogs/news for linking opportunities...');
    let publishedOdysshoesBlogs = [];
    try {
      publishedOdysshoesBlogs = await fetchPublishedBlogs();
      console.log(`✓ Found ${publishedOdysshoesBlogs.length} published blogs on odysshoes.com`);
    } catch (odysshoesError) {
      console.warn('⚠️ Could not fetch odysshoes.com blogs, continuing with empty list:', odysshoesError.message);
      publishedOdysshoesBlogs = [];
    }

    // Create cron jobs for each specified time
    const scheduledTasks = [];

    for (const time of times) {
      // Parse time (HH:MM) - assumed to be in Philippines Time (UTC+8)
      const [phtHours, phtMinutes] = time.split(":").map(Number);

      // Convert Philippines time to server local time
      const { hours: localHours, minutes: localMinutes } = convertPHTToServerTime(phtHours, phtMinutes);

      // Create cron expression using server local time
      const cronExpression = `${localMinutes} ${localHours} * * *`;

      const serverTimezoneOffset = getServerTimezoneOffsetHours();
      const serverTimezone = serverTimezoneOffset >= 0 ? `UTC+${serverTimezoneOffset}` : `UTC${serverTimezoneOffset}`;
      
      console.log(`Scheduling for PHT ${String(phtHours).padStart(2, '0')}:${String(phtMinutes).padStart(2, '0')} → Server local (${serverTimezone}): ${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')} [cron: ${cronExpression}]`);

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

    // Store job info in global job manager and persist to Supabase
    await jobManager.addJob(jobId, {
      keywords,
      times,
      scheduledTasks,
      shopifyShop,
      shopifyBlogId,
      shopifyToken,
      createdAt: new Date().toISOString(),
    });

    console.log(`Scheduled posting job created: ${jobId}`);
    console.log(`Keywords: ${keywords.join(", ")}`);
    console.log(`Posting times (Philippines Time - UTC+8): ${times.join(", ")}`);

    // Prepare response with detailed timezone information
    const scheduledTimesInfo = times.map(time => {
      const [phtHours, phtMinutes] = time.split(":").map(Number);
      const { hours: localHours, minutes: localMinutes } = convertPHTToServerTime(phtHours, phtMinutes);
      const serverTimezoneOffset = getServerTimezoneOffsetHours();
      const serverTimezone = serverTimezoneOffset >= 0 ? `UTC+${serverTimezoneOffset}` : `UTC${serverTimezoneOffset}`;
      
      return {
        phtTime: time,
        serverTime: `${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`,
        serverTimezone,
      };
    });

    return res.status(201).json({
      message: "Scheduled posting job created successfully",
      jobId,
      keywords,
      times,
      timeZone: "Philippines Time (UTC+8)",
      scheduledTimesInfo,
      odysshoesIntegration: {
        publishedBlogsCount: publishedOdysshoesBlogs.length,
        linkedBlogsAvailable: Math.round(publishedOdysshoesBlogs.length * 0.6), // Estimate ~60% will have phrase matches
        duplicatesSkipped: 0,
      },
      instructions: "Times are scheduled in Philippines Time (UTC+8). Use the job ID to stop this job. Send a POST request to /api/stop-posting with the jobId.",
    });
  } catch (error) {
    console.error("Error creating scheduled posting job:", error);
    return res.status(500).json({ error: "Failed to create scheduled posting job", details: error.message });
  }
}
