# Stop Scheduled Posts & Author Name

## Stopping Scheduled Posts

### Stop Button Location
In the web UI at `https://odysshoes-blog-creator-production.up.railway.app`:

1. Click **"▶ View Active Jobs"** button
2. See your active posting job with details
3. Click **"⏹ Stop"** button (red button on the right)
4. Confirm the action

The system will:
- ✅ Stop all cron tasks for that job
- ✅ Remove the job from database
- ✅ Mark job as completed in logs
- ✅ Stop generating new keywords

### Stop via API (Advanced)

```bash
# Get all active jobs
curl https://odysshoes-blog-creator-production.up.railway.app/api/stop-posting

# Stop a specific job
curl -X POST https://odysshoes-blog-creator-production.up.railway.app/api/stop-posting \
  -H "Content-Type: application/json" \
  -d '{"jobId": "schedule-1775190054777"}'
```

**Response:**
```json
{
  "message": "Scheduled posting job stopped successfully",
  "jobId": "schedule-1775190054777",
  "keywords": [...],
  "times": [...]
}
```

---

## Author Name on Published Blogs

### Current Author Name
All blogs posted via scheduled system use the author name: **"Scheduled Bot"**

**Where it appears:**
- Post author field in Shopify blog
- Meta author tag
- Blog post byline (if theme displays it)

**Example:**
```
By: Scheduled Bot
Posted: April 4, 2026
```

### Change Author Name (Optional)

If you want to change the author name from "Scheduled Bot" to something else:

**Method 1: Update Code (Recommended)**

Edit: `utils/jobRestoration.js` (Line ~25)

Change:
```javascript
author: "Scheduled Bot",  // ← Change this
```

To any name you want:
```javascript
author: "Your Store Name",
author: "Content Team",
author: "AI Writer",
// etc.
```

Then:
1. Commit changes: `git push`
2. Railway auto-deploys (5-10 min)
3. New blogs will use the new author name

**Method 2: Via Database (Advanced)**

Add an author field to `scheduled_jobs` table and pass it through the system.

---

## Managing Your Scheduled Jobs

### View Active Jobs
```
Web UI → "View Active Jobs" button
Shows:
- Job ID
- Keywords pool
- Posting times
- Progress bar
- Posted count vs total
- Creation date
```

### View Job Logs
```
Web UI → Active Jobs → "📊 View Logs"
Shows:
- Each keyword posting attempt
- Success or failure status
- Generated blog title
- Timestamp
```

### Stop a Job
```
Web UI → Active Jobs → "⏹ Stop" button
Or:
API POST /api/stop-posting with jobId
```

### Resume/Restart Posting
If you stop a job and want to restart:
1. Go to Schedule tab
2. Create new schedule with same/different keywords
3. New job ID will be generated
4. Posting starts immediately

---

## Timeline Example

**Your Job Status:**
- **Start**: April 4, 2026 @ 04:12 AM
- **Author**: "Scheduled Bot"
- **Keywords**: 21 → Auto-generates 10 more when exhausted
- **Posting Times**: 04:12 AM, 12:25 PM, 20:52 PM (Philippine Time)

**Sample Blog Post:**
```
Title: Complete Guide to Spider-Man Shoes
Author: Scheduled Bot
Posted: April 4, 2026 at 04:12 AM
Blog: "Amazing spider-man shoes collection..."
```

### Stopping the Job
```
SCENARIO: Running for 7 days, used all 21 keywords
ACTION: Click "⏹ Stop" button
RESULT: 
- All cron tasks stop immediately
- No new blogs posted
- No new keywords generated
- Job removed from database
- 21 blogs already published remain on Shopify
```

---

## Customizing Author Name

### Why Change It?
- Sound more professional (use store name)
- Appear as brand voice (use company name)
- Create multiple author personas (for variety)

### Files to Modify

**File 1: `utils/jobRestoration.js`**
```javascript
// Line ~25 - Change author name here
author: "Scheduled Bot",  // ← Your custom name
```

**File 2: `pages/api/schedule-posting.js`**
```javascript
// Line ~26 - Change author name here
author: "Scheduled Bot",  // ← Your custom name
```

Both places use the same author name.

### Testing Change
1. Update code
2. Push to GitHub
3. Wait for Railway redeploy (5-10 min)
4. Trigger manual blog post to test
5. Check Shopify blog for new author name

---

## Troubleshooting

### "Stop button doesn't work"
- Ensure job is still active (not already completed)
- Check Railway logs for errors
- Try API endpoint instead

### "Author name didn't change"
- Ensure you edited both files (jobRestoration.js + schedule-posting.js)
- Wait for Railway redeploy
- Try posting a new blog to test

### "Can't see active jobs"
- Refresh the page
- Check if job is already completed
- Check Supabase `scheduled_jobs` table

---

## Complete Workflow

### Create → Monitor → Stop

```
1. CREATE NEW SCHEDULE
   UI → Schedule tab → Fill form → Submit
   ↓
2. POSTING STARTS AUTOMATICALLY
   Cron triggers at scheduled times
   Opens tracks in published_blogs table
   ↓
3. MONITOR PROGRESS
   View Active Jobs → See progress bar
   View Logs → See each post attempt
   Check Shopify blog → See published posts
   ↓
4. WHEN DONE - STOP JOB
   View Active Jobs → Click "⏹ Stop"
   OR: Manual API call to stop-posting endpoint
   ↓
5. REVIEW RESULTS
   published_blogs table → See all blogs posted
   Shopify blog → See live posts
   job_logs → See success/failure details
```

---

## Summary

✅ **Stop Posting:**
- Click "⏹ Stop" button in UI
- Or: POST to `/api/stop-posting` endpoint

✅ **Author Name:**
- Current: "Scheduled Bot"
- Change by editing: `utils/jobRestoration.js` + `pages/api/schedule-posting.js`
- Push → Railway redeploys automatically

✅ **Full Control:**
- View active jobs anytime
- Monitor progress with live bar
- See detailed logs for each post
- Stop at any time, resume anytime

Your system is fully manageable! 🚀
