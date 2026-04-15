# Retrieving Posted Blogs & Archived Jobs

## Overview

When you stop a scheduled posting job, your data is **no longer deleted**. Instead, it's **archived** so you can:
- ✅ View all published blogs with their metadata
- ✅ Download blog data as JSON or CSV
- ✅ Permanently delete after backing up (optional)

---

## 1. Get All Published Blogs Since Starting Schedule

### Option A: View All Blogs (Web UI)

```bash
# Get all published blogs across all jobs
curl https://odysshoes-blog-creator-production.up.railway.app/api/published-blogs

# Get published blogs for a specific job
curl https://odysshoes-blog-creator-production.up.railway.app/api/published-blogs?jobId=schedule-1234567890
```

**Response Example:**
```json
{
  "message": "All published blogs across all jobs",
  "totalJobs": 2,
  "totalBlogs": 47,
  "blogsByJob": {
    "schedule-1775190054777": [
      {
        "id": 123,
        "keyword": "running shoes",
        "title": "Best Running Shoes for Marathon Training",
        "slug": "best-running-shoes-marathon",
        "imageUrl": "https://...",
        "metaDescription": "Discover the top running shoes...",
        "generatedAt": "2026-04-15T14:30:00.000Z"
      },
      // ... more blogs
    ],
    "schedule-1775190123456": [
      // ... more blogs
    ]
  }
}
```

### Option B: Download as File

**JSON Format:**
```bash
curl https://odysshoes-blog-creator-production.up.railway.app/api/download-blogs?jobId=schedule-1234567890&format=json \
  -o blogs-backup.json
```

**CSV Format:**
```bash
curl https://odysshoes-blog-creator-production.up.railway.app/api/download-blogs?jobId=schedule-1234567890&format=csv \
  -o blogs-backup.csv
```

**Download in Browser:**
- [Download JSON](https://odysshoes-blog-creator-production.up.railway.app/api/download-blogs?jobId=schedule-1234567890&format=json)
- [Download CSV](https://odysshoes-blog-creator-production.up.railway.app/api/download-blogs?jobId=schedule-1234567890&format=csv)

---

## 2. Stop Project Without Losing Data

When you click **"⏹ Stop"** or call the API:

```bash
curl -X POST https://odysshoes-blog-creator-production.up.railway.app/api/stop-posting \
  -H "Content-Type: application/json" \
  -d '{"jobId": "schedule-1234567890"}'
```

**Response (NEW):**
```json
{
  "message": "Scheduled posting job stopped successfully",
  "jobId": "schedule-1234567890",
  "stoppedAt": "2026-04-15T15:45:00.000Z",
  "summary": {
    "totalKeywordsPooled": 50,
    "blogsPosted": 47
  },
  "publishedBlogs": [
    {
      "keyword": "running shoes",
      "title": "Best Running Shoes for Marathon Training",
      "slug": "best-running-shoes-marathon",
      "imageUrl": "https://...",
      "metaDescription": "Discover the top running shoes..."
    },
    // ... all published blogs
  ],
  "downloadOptions": {
    "jsonDownload": "/api/download-blogs?jobId=schedule-1234567890&format=json",
    "csvDownload": "/api/download-blogs?jobId=schedule-1234567890&format=csv",
    "viewAllBlogs": "/api/published-blogs?jobId=schedule-1234567890"
  },
  "note": "Job data is archived and available for download before permanent deletion"
}
```

---

## 3. View Archived Jobs

After stopping jobs, they enter "archived" status:

```bash
# View all archived jobs
curl https://odysshoes-blog-creator-production.up.railway.app/api/archived-jobs
```

**Response:**
```json
{
  "message": "Archived posting jobs",
  "totalArchived": 2,
  "archivedJobs": [
    {
      "jobId": "schedule-1775190054777",
      "keywords": ["running shoes", "athletic wear", "sneakers"],
      "times": ["08:00", "12:00", "18:00"],
      "shopifyShop": "my-store.myshopify.com",
      "createdAt": "2026-04-01T10:00:00.000Z",
      "stoppedAt": "2026-04-15T15:45:00.000Z",
      "totalBlogsPosted": 47,
      "downloadOptions": {
        "json": "/api/download-blogs?jobId=schedule-1775190054777&format=json",
        "csv": "/api/download-blogs?jobId=schedule-1775190054777&format=csv"
      }
    },
    // ... more archived jobs
  ],
  "nextSteps": "Use POST with jobId and action='delete' to permanently delete an archived job"
}
```

---

## 4. Permanently Delete Archived Job (Optional)

Only delete after you've backed up the data:

```bash
curl -X POST https://odysshoes-blog-creator-production.up.railway.app/api/archived-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "schedule-1234567890",
    "action": "delete"
  }'
```

**Response:**
```json
{
  "message": "Archived job permanently deleted",
  "jobId": "schedule-1234567890",
  "note": "Published blogs remain in the database for historical reference unless also deleted"
}
```

---

## 5. Complete Workflow Example

### Step 1: View Active Jobs
```bash
curl https://odysshoes-blog-creator-production.up.railway.app/api/stop-posting
```

### Step 2: Download Blogs Before Stopping (Optional)
```bash
# Download as JSON
curl "https://odysshoes-blog-creator-production.up.railway.app/api/download-blogs?jobId=schedule-1775190054777&format=json" \
  -o my-blogs.json

# Download as CSV for spreadsheet
curl "https://odysshoes-blog-creator-production.up.railway.app/api/download-blogs?jobId=schedule-1775190054777&format=csv" \
  -o my-blogs.csv
```

### Step 3: Stop the Job
```bash
curl -X POST https://odysshoes-blog-creator-production.up.railway.app/api/stop-posting \
  -H "Content-Type: application/json" \
  -d '{"jobId": "schedule-1775190054777"}'
```

### Step 4: View Archived Jobs
```bash
curl https://odysshoes-blog-creator-production.up.railway.app/api/archived-jobs
```

### Step 5: Permanently Delete (Optional)
```bash
curl -X POST https://odysshoes-blog-creator-production.up.railway.app/api/archived-jobs \
  -H "Content-Type: application/json" \
  -d '{"jobId": "schedule-1775190054777", "action": "delete"}'
```

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/published-blogs` | GET | View all published blogs |
| `/api/published-blogs?jobId=X` | GET | View blogs for specific job |
| `/api/download-blogs?jobId=X&format=json` | GET | Download as JSON file |
| `/api/download-blogs?jobId=X&format=csv` | GET | Download as CSV file |
| `/api/stop-posting?jobId=X` | POST/GET | Stop job (now archives instead of deletes) |
| `/api/archived-jobs` | GET | View all archived jobs |
| `/api/archived-jobs` | POST | Delete archived job (with action="delete") |

---

## Data Storage Location

### Published Blogs
- **Primary Storage:** Supabase `published_blogs` table
- **Backup:** Download as JSON or CSV
- **Local Logs:** `logs/jobs-log.json`

### Job Configuration
- **Active Jobs:** Supabase `scheduled_jobs` table (status = "active")
- **Archived Jobs:** Supabase `scheduled_jobs` table (status = "archived", kept for reference)

---

## FAQ

**Q: Will my blogs be deleted if I stop the job?**
A: No! Stopping the job now archives it. All published blog data is preserved.

**Q: Can I get back a deleted job?**
A: You can download the blog data from the archived state. The job configuration is preserved for 30 days (configurable).

**Q: What happens if I restart my server?**
A: Only active jobs (status = "active") restore and run. Archived jobs remain archived.

**Q: Can I export all jobs at once?**
A: Use `/api/published-blogs` to get all blogs across all jobs, then download individually by jobId.
