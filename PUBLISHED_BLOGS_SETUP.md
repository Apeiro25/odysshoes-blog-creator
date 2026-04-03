# Published Blogs Tracking Database Setup

## Overview

This system now tracks all published blogs and their associated keywords in Supabase. This enables:
- ✅ Duplicate prevention (no two blogs from same keyword)
- ✅ Auto-keyword generation when all keywords are exhausted
- ✅ Continuous posting cycle without manual intervention
- ✅ Analytics on what keywords generated what blogs

---

## Supabase Table: `published_blogs`

You need to create this table in your Supabase database.

### Option 1: Using Supabase Dashboard (Easy)

1. Go to your Supabase project: https://app.supabase.com
2. Click **"SQL Editor"**
3. Click **"New Query"**
4. Copy and paste this SQL:

```sql
CREATE TABLE published_blogs (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  title TEXT,
  slug TEXT,
  image_url TEXT,
  meta_description TEXT,
  content_preview TEXT,
  shopify_post_id TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(job_id, keyword),
  CONSTRAINT fk_job FOREIGN KEY (job_id) REFERENCES scheduled_jobs(id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX idx_published_blogs_job_id ON published_blogs(job_id);
CREATE INDEX idx_published_blogs_keyword ON published_blogs(keyword);
CREATE INDEX idx_published_blogs_generated_at ON published_blogs(generated_at DESC);
```

5. Click **"Run"**
6. Done! ✅

### Option 2: Manual Table Creation

**Step 1**: In Supabase, go to **Table Editor**
**Step 2**: Click **"Create a new table"**, name it `published_blogs`
**Step 3**: Add these columns:

| Column | Type | Settings |
|--------|------|----------|
| `id` | `bigint` | Primary Key, Auto increment |
| `job_id` | `text` | Not null |
| `keyword` | `text` | Not null |
| `title` | `text` | Nullable |
| `slug` | `text` | Nullable |
| `image_url` | `text` | Nullable |
| `meta_description` | `text` | Nullable |
| `content_preview` | `text` | Nullable |
| `shopify_post_id` | `text` | Nullable |
| `generated_at` | `timestamp` | Default: `now()` |
| `created_at` | `timestamp` | Default: `now()` |

**Step 4**: Add constraint:
- Go to **"Constraints"** tab
- Add: `UNIQUE(job_id, keyword)` to prevent duplicate keyword posts

**Step 5**: Create indexes for performance:
- Go to **SQL Editor**
- Execute the index creation SQL above

---

## How It Works

### Flow 1: Normal Posting (Keywords Available)
```
1. Cron triggers at scheduled time (e.g., 4:12 AM)
   ↓
2. Check database for already-published keywords
   ↓
3. Select unused keyword randomly
   ↓
4. Check if keyword has duplicate blog (prevent duplicates)
   ↓
5. Generate and post blog
   ↓
6. Track in database: keyword → blog title mapping
```

### Flow 2: Auto-Regeneration (All Keywords Exhausted)
```
1. Cron triggers at scheduled time
   ↓
2. Check database for used keywords (all 21 exhausted)
   ↓
3. **Automatically generate 10 new keywords** using OpenAI
   ↓
4. Add new keywords to job
   ↓
5. Select from new keywords
   ↓
6. Generate and post blog
   ↓
7. Continue with Flow 1 for remaining new keywords
```

---

## Key Features

### 1. Duplicate Prevention
```javascript
// Before posting, check:
- Is this keyword already used? → SKIP if yes
- Does a blog with this title exist? → SKIP if yes
```

### 2. Auto-Keyword Generation
```javascript
// When all keywords exhausted:
- OpenAI analyzes your original keywords
- Generates 10 new, related keywords
- Updates job in real-time
- Continues posting automatically (no manual action needed)
```

### 3. Tracking Blog-Keyword Relationship
```javascript
// Each published blog stores:
{
  job_id: "schedule-1775190054777",
  keyword: "spiderman shoes",
  title: "Amazing Spider-Man Shoes Guide 2024",
  slug: "amazing-spider-man-shoes-guide-2024",
  image_url: "https://...",
  generated_at: "2024-04-03T04:12:00Z"
}
```

---

## After Setup

Once the table is created:

1. **Railway will auto-deploy** your code changes
2. **First blog post** will include the keyword tracking
3. **View tracked blogs**: Go to Supabase → Table Editor → `published_blogs`
4. **Query analytics**: 
```sql
-- See all blogs for your job
SELECT * FROM published_blogs WHERE job_id = 'schedule-1775190054777';

-- Count blogs generated
SELECT COUNT(*) FROM published_blogs WHERE job_id = 'schedule-1775190054777';

-- See daily posting activity
SELECT DATE(generated_at), COUNT(*) as blogs_posted 
FROM published_blogs 
GROUP BY DATE(generated_at);
```

---

## Example: Your First Day

**Timeline (Philippine Time - UTC+8):**

- **04:12 AM**: First cron fires → Picks "spiderman shoes" → Post blog #1
- **12:25 PM**: Second cron fires → Picks "deadpool shoes" → Post blog #2
- **20:52 PM**: Third cron fires → Picks "how to stop shoes from blistering" → Post blog #3

**Next Day:**

- **04:12 AM**: Picks "how to dry shoes in dryer" → Post blog #4
- ...continues until all 21 keywords posted...

**After 7+ days (All keywords exhausted):**

- **04:12 AM**: System detects all keywords used
- **Auto-generates** 10 new keywords like:
  - "best shoes for hiking trails"
  - "waterproof shoes brands"
  - "eco-friendly vegan shoes"
  - etc.
- **Continues posting** automatically with new keywords
- Cycle repeats infinitely!

---

## Cost Considerations

- **Supabase**: Free tier included
- **OpenAI**: Each keyword generation uses ~100-200 tokens (~$0.0003-0.0006)
  - Monthly cost for keyword generation: ~$0.10-0.20 (minimal)
- **Railway**: Free tier includes plenty of credits

---

## Troubleshooting

### "Table doesn't exist" error
- Check Supabase: Table Editor → Look for `published_blogs`
- If missing: Follow setup steps above
- Restart Railway: Force redeploy in dashboard

### "Not tracking blogs"
- Ensure table is created and deployed
- Check Railway logs for errors
- Verify environment variables are set

### "Not auto-generating keywords"
- Ensure OpenAI key is set in Railway variables
- Check logs: "Generating keywords..." message
- Try manual post to test OpenAI connection

---

## Monitoring

**Check Status:**

1. **Railway Dashboard**: https://railway.app
   - Look for logs: "Successfully generated and posted blog"
   
2. **Supabase**: Table Editor → `published_blogs`
   - Refresh to see new blog records
   
3. **Your Shopify Blog**: New posts appear automatically

---

## Questions?

Your system now has:
✅ 24/7 automatic posting
✅ No duplicate blogs
✅ Auto-keyword generation
✅ Full tracking and analytics
✅ Unlimited content cycle

Just ensure the `published_blogs` table exists and Railway is running! 🚀
