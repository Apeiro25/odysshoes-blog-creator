# 6 Daily Posts Configuration Guide

## Overview

Your blog automation system is configured to post **6 times per day** at fixed times. The posting schedule cannot be customized via the UI.

---

## Fixed Posting Times

The system posts at these fixed times (Philippines Time - UTC+8):
- **6:00 AM** (06:00)
- **10:00 AM** (10:00)  
- **2:00 PM** (14:00)
- **6:00 PM** (18:00)
- **10:00 PM** (22:00)
- **2:00 AM** (02:00)

---

## How the Posting Schedule Works

### Fixed Daily Cycle

Every day, your system will post at these fixed times (Philippines Time):

1. **6:00 AM** → Generate & post blog #1
2. **10:00 AM** → Generate & post blog #2
3. **2:00 PM** → Generate & post blog #3
4. **6:00 PM** → Generate & post blog #4
5. **10:00 PM** → Generate & post blog #5
6. **2:00 AM** → Generate & post blog #6

**Total: 6 new blogs posted daily**

### Keyword Rotation

- The system automatically selects keywords from your pool for each post
- Keywords are rotated to prevent duplicates in the same schedule cycle
- If all keywords are exhausted, the system can auto-generate new ones
- All published blogs are logged and checked for duplicates

---

## Setting Up Auto-Posting

### Step 1: Create Shopify Connection
1. Go to **Settings** (gear icon)
2. Enter your Shopify credentials
3. Click **Save**

### Step 2: Start Auto-Posting
1. Click **"⏰ Schedule"** tab
2. (Optional) Enter keywords or leave blank for auto-generation
3. View the fixed posting schedule displayed on the screen
4. Click **"🚀 Start Auto-Posting"**

### Step 3: Verify
- A confirmation alert shows your job ID and posting times
- View **"Active Jobs"** to see the job running
- Blogs will post at exactly those times each day

---

## Customizing Posting Times

To use different posting times, you need to modify the code:

### Option 1: Edit pages/api/schedule-posting.js

Find this line:
```javascript
times = ["06:00", "10:00", "14:00", "18:00", "22:00", "02:00"]
```

Change it to your preferred times (24-hour format):
```javascript
times = ["06:00", "09:00", "12:00", "15:00", "18:00"]  // 5 times
times = ["08:00", "12:00", "16:00", "20:00"]  // 4 times
times = ["07:00", "13:00", "19:00", "01:00"]  // 4 times with overnight
```

Then redeploy the application.

---

## Scheduling Tips

### For Content Consistency
Post during hours your audience is most active:
```
08:00, 11:00, 14:00, 17:00, 20:00  # Peaks hours
```

### For SEO Distribution
Spread posts evenly throughout the day:
```
06:00, 10:00, 14:00, 18:00, 22:00  # Evenly distributed
```

### For Global Coverage (Asian/European audiences)
```
02:00, 08:00, 14:00, 20:00  # 24-hour rotation
```

---

## Modifying the Active Job
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
