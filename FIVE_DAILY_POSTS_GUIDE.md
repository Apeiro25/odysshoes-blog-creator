# 5 Daily Posts Configuration Guide

## Overview

Your blog automation system now supports posting **5 times per day** instead of 3. You can customize the exact times in the UI when setting up your scheduled posting jobs.

---

## Default Posting Times

The system comes with these default times:
- **6:00 AM** (06:00)
- **9:00 AM** (09:00)  
- **12:00 PM** (12:00)
- **3:00 PM** (15:00)
- **6:00 PM** (18:00)

---

## How to Configure Custom Times

### In the Web UI

1. Go to your blog creator app
2. Click on **"⏰ Schedule"** tab
3. Enter your keywords (comma-separated)
4. In the **"Posting Times"** field, enter 5 times in 24-hour format

### Format: HH:MM,HH:MM,HH:MM,HH:MM,HH:MM

Examples:
```
05:00,08:00,11:00,14:00,17:00     # 5 AM, 8 AM, 11 AM, 2 PM, 5 PM
06:00,09:00,12:00,15:00,18:00     # Default times
07:00,10:00,13:00,16:00,19:00     # 7 AM, 10 AM, 1 PM, 4 PM, 7 PM
06:00,09:00,12:00,15:00,20:00     # 6 AM, 9 AM, 12 PM, 3 PM, 8 PM
```

### Important Rules

✅ **Use 24-hour format** (00:00 to 23:59)
✅ **Comma-separated** with no spaces (or spaces are fine, they're trimmed)
✅ **Exactly 5 times** (or any number you want - the system is flexible)
✅ **Times in ascending order** (optional but recommended)

❌ **Don't use 12-hour format** (e.g., 6:00 PM won't work)
❌ **Don't use special characters** (only HH:MM and commas)

---

## Example: Setting Up 5 Daily Posts

### Step 1: Create Shopify Connection
1. Go to **Settings** (gear icon)
2. Enter your Shopify credentials
3. Click **Save**

### Step 2: Configure Times
1. Click **"⏰ Schedule"** tab
2. Enter keywords: `running shoes, casual shoes, hiking shoes, athletic shoes, water shoes`
3. Enter posting times: `06:00,09:00,12:00,15:00,18:00`
4. Click **"🚀 Start Scheduler"**

### Step 3: Verify
- A confirmation alert shows your job ID and posting times
- View **"Active Jobs"** to see the job running
- Blogs will post at exactly those times each day

---

## How It Works

### Daily Cycle

Each day, your system will:

1. **6:00 AM** → Pick random keyword → Generate & post blog #1
2. **9:00 AM** → Pick different keyword → Generate & post blog #2
3. **12:00 PM** → Pick different keyword → Generate & post blog #3
4. **3:00 PM** → Pick different keyword → Generate & post blog #4
5. **6:00 PM** → Pick different keyword → Generate & post blog #5

**Total: 5 new blogs posted daily**

### Keyword Rotation

- The system prevents duplicate keywords being used
- If all keywords are used, it auto-generates new ones using OpenAI
- You can have unlimited blogs posted with automatic keyword generation

---

## Scheduling Tips

### For Content Consistency
Post during hours your audience is most active:
```
08:00,11:00,14:00,17:00,19:00    # Early morning, late evening
```

### For SEO Distribution
Spread posts throughout the day:
```
06:00,09:00,12:00,15:00,18:00    # Evenly distributed
```

### For Overnight Coverage (Asian/Europe expansion)
```
00:00,06:00,12:00,18:00,22:00    # 24-hour coverage
```

---

## Modifying Times While Running

### To Change Posting Times

1. **Stop the current job** by clicking the stop button
2. **Note:** All published blogs are preserved and won't be deleted
3. Create a new job with different times
4. Old job is archived but remains in database for reference

### Stop Posting Without Losing Blogs

When you click **"Stop Posting"**:
- ✅ The job stops running
- ✅ All blogs already posted stay on your Shopify store
- ✅ All blog records remain in `published_blogs` table
- ✅ You can view/download all posted blogs later

---

## Database: published_blogs

All your posted blogs are tracked in Supabase:

```sql
-- View all blogs posted today
SELECT * FROM published_blogs 
WHERE DATE(generated_at) = CURRENT_DATE
ORDER BY generated_at DESC;

-- Count total blogs for a job
SELECT COUNT(*) as total_blogs 
FROM published_blogs 
WHERE job_id = 'schedule-1775190054777';

-- See posting activity
SELECT 
  DATE(generated_at) as date,
  COUNT(*) as blogs_posted
FROM published_blogs
GROUP BY DATE(generated_at)
ORDER BY date DESC;
```

---

## Troubleshooting

### Blogs Not Posting at Scheduled Times

1. Check your **Railway dashboard** for logs
2. Verify Shopify credentials are correct
3. Ensure at least one keyword is configured
4. Check that you're not out of API quota (OpenAI, Shopify)

### "Invalid time format" Error

Make sure times are:
- In 24-hour format (08:00, not 8:00 AM)
- Comma-separated
- Within valid range (00:00-23:59)

### Want to Add More Than 5 Times?

You can post **7 times, 10 times, or any number**:

```
06:00,07:00,09:00,11:00,13:00,15:00,17:00,19:00  # 8 times daily
```

Just enter any number of times in HH:MM format!

---

## Examples by Industry

### Fashion E-commerce
```
08:00,12:00,15:00,18:00,20:00    # Peak shopping hours
```

### B2B/Professional Services
```
09:00,11:00,13:00,15:00,17:00    # Business hours
```

### Global Audience
```
00:00,06:00,12:00,18:00,23:00    # Timezone coverage
```

### Night Shift/Content Creators
```
21:00,00:00,03:00,06:00,09:00    # Evening/overnight focus
```

---

## Next Steps

1. ✅ Configure your 5 posting times
2. ✅ Start a scheduled posting job
3. ✅ Monitor the "Active Jobs" section
4. ✅ Watch blogs post automatically!

Your system is ready for 5 daily posts! 🚀
