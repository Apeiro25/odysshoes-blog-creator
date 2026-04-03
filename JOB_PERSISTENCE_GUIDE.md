# Scheduled Job Persistence with Supabase

## Overview
Your scheduled blog posting jobs are now **persisted to Supabase Cloud Database**, ensuring they survive:
- ✅ Server restarts
- ✅ Laptop shutdowns
- ✅ Your local server being turned off
- ✅ Vercel deployments
- ✅ Process crashes

**Jobs run automatically on Vercel 24/7!**

## How It Works

### 1. Job Lifecycle
1. You create a scheduled job via `/api/schedule-posting`
2. Job is **stored in memory** (for quick access)
3. Job is **persisted to Supabase database**
4. Cron tasks run at scheduled times
5. Blogs post to Shopify automatically

### 2. On Server Restart/Redeploy
1. Server initializes (`server.js` or Vercel serverless)
2. `jobManager.loadJobsFromDatabase()` fetches all jobs from Supabase
3. `restoreActiveJobs()` recreates cron tasks for each job
4. Posting continues automatically ✅

### 3. On Vercel
- Jobs are stored in Supabase (persistent cloud database)
- Each Vercel deployment loads jobs from Supabase
- Jobs restore automatically with zero configuration
- Works 24/7 without your laptop!

## Setup

### Prerequisites
✅ Already configured! Your Supabase credentials are in `.env.local`:
- `SUPABASE_URL`
- `SUPABASE_KEY`

### Database Table
The `scheduled_jobs` table was automatically created with:
- `id` (TEXT, PRIMARY KEY) - Job ID
- `keywords` (TEXT ARRAY) - Keywords to post
- `times` (TEXT ARRAY) - Posting times (HH:MM format)
- `shopify_shop` (TEXT) - Your Shopify store
- `shopify_blog_id` (TEXT) - Blog ID
- `shopify_token` (TEXT) - API token for posting
- `created_at` (TIMESTAMP) - Job creation time
- `updated_at` (TIMESTAMP) - Last update time

## Usage

### Create a Scheduled Job
```bash
curl -X POST http://localhost:3000/api/schedule-posting \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["running shoes", "athletic wear"],
    "times": ["08:00", "12:00", "18:00"],
    "shopifyToken": "your_token",
    "shopifyShop": "your-store.myshopify.com",
    "shopifyBlogId": "123456789"
  }'
```

### Check Job Status
```bash
# See all active jobs and restoration status
curl http://localhost:3000/api/job-restore
```

Response:
```json
{
  "status": "ok",
  "storage": "Supabase Cloud Database",
  "summary": {
    "totalActiveJobs": 2,
    "jobsWithRunningTasks": 2,
    "jobsNeedingRestart": 0
  },
  "allActiveJobs": [
    {
      "jobId": "schedule-1234567890",
      "keywords": ["running shoes"],
      "times": ["08:00"],
      "hasActiveTasks": true,
      "createdAt": "2026-04-03T10:30:00.000Z"
    }
  ]
}
```

### Stop a Job
```bash
curl -X POST http://localhost:3000/api/stop-posting \
  -H "Content-Type: application/json" \
  -d '{"jobId": "schedule-1234567890"}'
```

### Manually Restore Jobs (if needed)
```bash
curl -X POST http://localhost:3000/api/job-restore?action=restore
```

### Clear In-Memory Jobs
```bash
curl -X POST http://localhost:3000/api/job-restore?action=clear-memory
```

## Local Development

### Start server with job restoration
```bash
npm install  # Install @supabase/supabase-js
npm start
```

### Development with hot-reload
```bash
npm run dev
```

## Production Deployment (Vercel)

Jobs work automatically on Vercel! No additional configuration needed:

1. **On Deploy**: Vercel initializes serverless functions
2. **First Request**: Jobs are loaded from Supabase database
3. **Cron Restore**: Jobs are restored on first API call to `/api/schedule-posting`
4. **Continuous**: Jobs run 24/7 at scheduled times
5. **Persistence**: All job data persists in Supabase

### To Deploy to Vercel
```bash
git push origin main
```

Vercel automatically deploys. Your jobs continue running without interruption!

## Important Notes

### Job Persistence Locations
- **In-Memory Cache**: Current server process (for speed)
- **Persistent Storage**: Supabase Cloud Database (for durability)
- **Logs**: `logs/jobs-log.json` (local development only)

### Supabase Free Tier Limits
✅ **More than enough for your use case:**
- 500MB storage (jobs are tiny)
- 50,000 queries/month (you'll use <100)
- Unlimited API calls
- No credit card required

### Data Security
- API key is marked as "anon" (read/write appropriate data)
- Row-level security can be configured if needed
- Credentials in `.env.local` are never committed to git

## Troubleshooting

### Jobs disappearing after restart?
1. Check Supabase: https://app.supabase.com → Your Project → `scheduled_jobs` table
2. Verify `.env.local` has correct credentials
3. Check server logs for restoration messages

### "Connection failed" errors?
- Verify `SUPABASE_URL` and `SUPABASE_KEY` in `.env.local`
- Check your internet connection
- Ensure Supabase project hasn't been paused

### Jobs not posting at scheduled time?
1. Check job status: `GET /api/job-restore`
2. Verify `hasActiveTasks: true` for your job
3. Check Shopify token validity
4. Review server logs for errors

### Want to see your jobs in Supabase?
1. Go to https://app.supabase.com
2. Select your project
3. Go to **Data** → **scheduled_jobs**
4. View, edit, or delete jobs directly

## Features

✅ **Cloud Persistence** - Jobs survive everything
✅ **24/7 Availability** - Runs on Vercel automatically
✅ **Zero Configuration** - Just push to Vercel
✅ **Free Supabase** - No extra cost
✅ **Automatic Restoration** - Jobs restore without manual intervention
✅ **Easy Management** - Check status, restore, or clear jobs via API
✅ **Backward Compatible** - No changes to `/api/schedule-posting` endpoint

## Migration from File-Based Storage

If you were using file-based storage previously:
- All new jobs use Supabase
- Old file-based jobs can be manually migrated by recreating them
- Run `npm install` to get updated dependencies
- Old `logs/active-jobs.json` file can be deleted

## Next Steps

1. ✅ Credentials added to `.env.local`
2. ✅ Supabase package added to `package.json`
3. ✅ Run `npm install` to download dependencies
4. ✅ Restart your server or redeploy to Vercel
5. ✅ Create scheduled jobs and watch them persist!
