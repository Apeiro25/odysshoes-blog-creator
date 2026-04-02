# Job Logging & Tracking Guide

## Overview
The system now tracks every blog post generated during scheduled posting with detailed logs, including:
- ✅ Success/failure status for each keyword
- 📅 Timestamp of each posting
- 📊 Progress tracking (% complete)
- 🔍 Individual blog titles and images
- ⏹️ **Auto-stop when all keywords are posted**

---

## Features

### 1. Individual Blog Logging
Every blog posted is logged with:
- Keyword used
- Success/failure status
- Timestamp
- Blog title
- Image URL (if successful)
- Error message (if failed)

### 2. Progress Tracking
- **Visual progress bar** shows % of keywords covered
- Shows count: "X / Y blogs posted"
- Auto-updates as jobs run

### 3. Auto-Stop on Completion
- Automatically stops the job once **all keywords** have been successfully posted at least once
- Creates a "completed" status in logs
- Saves server resources

### 4. Detailed Job Logs Viewer
Click **📊 View Logs** on any active job to see:
- Job status (Running / Completed)
- Total keywords
- Success and failure counts
- List of all posted blogs with details
- Keywords remaining to be covered

---

## Troubleshooting

### Issue: "Failed to stop scheduled blog" or Job not found
**Causes:**
- Server was restarted (jobs stored in memory are lost)
- Job ID is old/from previous session
- Job already completed

**Solutions:**

#### Option A: Force Cleanup an Old Job
```bash
curl -X POST "http://localhost:3000/api/job-cleanup?action=cleanup" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "schedule-1775143086425"}'
```

This removes the job from logs even if it's not currently active.

#### Option B: View Job History
Check if the job exists:
```bash
curl http://localhost:3000/api/job-cleanup
```

Response shows:
- Active jobs (currently running)
- Job history (all past jobs)
- Job status and completion date

#### Option C: Clean Up All Old Jobs
```bash
curl -X POST "http://localhost:3000/api/job-cleanup?action=cleanup-all" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Automatically cleans up old job logs that aren't currently active.

---

## Using the UI

### Step 1: View Active Jobs
1. Select **⏰ Schedule Posting** mode
2. Click **View Active Jobs** button
3. See all running jobs with progress bars

### Step 2: Monitor Progress
- **Progress Bar** shows % complete
- **Posted Count** shows "X / Y blogs posted"
- **Status** changes to ✓ Completed when all keywords are done

### Step 3: View Detailed Logs
Click **📊 View Logs** on any job to see:
- Summary stats
- List of all posted blogs
- Individual success/failure status
- Error messages (if any)

### Step 4: Stop a Job
Click **✕ Stop Job** to manually stop before completion

**Note:** If the job says "not found", use the cleanup endpoint above.

---

## API Endpoints

### Get Job Logs
```bash
GET /api/job-logs?jobId=schedule-1234567890
```

Response includes:
- `summary.percentageComplete` - % of keywords covered
- `summary.allKeywordsPosted` - true if all keywords have posted
- `postedBlogs` - array of all posted blogs with status
- `status` - "running" or "completed"

### Get All Job Logs
```bash
GET /api/job-logs
```

### Job Cleanup
```bash
# View active jobs and history
GET /api/job-cleanup

# Force cleanup a specific job
POST /api/job-cleanup?action=cleanup
Body: {"jobId": "schedule-xxx"}

# Cleanup all old jobs
POST /api/job-cleanup?action=cleanup-all
Body: {}
```

---

## How Auto-Stop Works

The system automatically stops when:
1. ✅ Every keyword in your list has been successfully posted at least once
2. The scheduler detects all keywords are covered
3. All cron tasks are stopped
4. Job status changes to "completed"
5. Server resources are freed

**Example:**
```
Keywords: ["custom shoes", "running sneakers", "shoe care"]
↓
08:00 → Posts "custom shoes" ✓
12:00 → Posts "running sneakers" ✓
18:00 → Posts "shoe care" ✓
↓
All keywords covered → Job auto-stops
```

---

## Log Storage

Logs are stored in: `logs/jobs-log.json`

Each job has:
```json
{
  "schedule-1234567890": {
    "createdAt": "2024-04-02T10:00:00.000Z",
    "completedAt": "2024-04-02T18:15:30.000Z",
    "status": "completed",
    "postedBlogs": [
      {
        "keyword": "custom shoes",
        "status": "success",
        "timestamp": "2024-04-02T08:00:15.000Z",
        "title": "Best Custom Shoe Brands"
      }
    ]
  }
}
```

---

## Summary

| Feature | Before | After |
|---------|--------|-------|
| Track posted blogs | ❌ Manual | ✅ Automatic |
| See progress | ❌ No | ✅ Yes (%) |
| View blog history | ❌ No | ✅ Yes (detailed) |
| Auto-stop on completion | ❌ No | ✅ Yes |
| Error tracking | ❌ No | ✅ Yes |
| Fix stuck jobs | ❌ N/A | ✅ Cleanup API |
