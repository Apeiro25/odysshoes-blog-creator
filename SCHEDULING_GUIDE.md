# Blog Scheduling Setup Guide

## Overview
This system allows you to automatically generate and post blogs to Shopify **3 times per day** (or any custom times you specify). You control which keywords are used and can stop the scheduling at any time.

---

## Installation

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

---

## How to Use

### 1. Start Scheduled Posting

**Endpoint:** `POST /api/schedule-posting`

**Request Body:**
```json
{
  "keywords": ["best running shoes", "shoe care tips", "custom sneakers"],
  "times": ["08:00", "12:00", "18:00"],
  "shopifyToken": "your_shopify_token",
  "shopifyShop": "your-shop.myshopify.com",
  "shopifyBlogId": "your_blog_id"
}
```

**Parameters:**
- `keywords` (required): Array of keywords to generate blogs from
- `times` (optional): Array of times in HH:MM format (24-hour). Default: `["08:00", "12:00", "18:00"]`
- `shopifyToken` (optional): Shopify API token (can use env variable instead)
- `shopifyShop` (optional): Shopify shop URL
- `shopifyBlogId` (optional): Shopify blog ID

**Example with cURL:**
```bash
curl -X POST http://localhost:3000/api/schedule-posting \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["best running shoes", "shoe care tips"],
    "times": ["08:00", "14:00", "20:00"],
    "shopifyToken": "shpat_xxxxx",
    "shopifyShop": "myshop.myshopify.com",
    "shopifyBlogId": "12345"
  }'
```

**Response:**
```json
{
  "message": "Scheduled posting job created successfully",
  "jobId": "schedule-1712000000000",
  "keywords": ["best running shoes", "shoe care tips"],
  "times": ["08:00", "14:00", "20:00"],
  "instructions": "Use the job ID to stop this job. Send a POST request to /api/stop-posting with the jobId."
}
```

---

### 2. View Active Scheduled Jobs

**Endpoint:** `GET /api/stop-posting`

**Response:**
```json
{
  "message": "Active scheduled posting jobs",
  "activeJobs": [
    {
      "jobId": "schedule-1712000000000",
      "keywords": ["best running shoes", "shoe care tips"],
      "times": ["08:00", "14:00", "20:00"],
      "createdAt": "2024-04-02T10:00:00.000Z"
    }
  ]
}
```

---

### 3. Stop Scheduled Posting

**Endpoint:** `POST /api/stop-posting`

**Request Body:**
```json
{
  "jobId": "schedule-1712000000000"
}
```

**Example with cURL:**
```bash
curl -X POST http://localhost:3000/api/stop-posting \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "schedule-1712000000000"
  }'
```

**Response:**
```json
{
  "message": "Scheduled posting job stopped successfully",
  "jobId": "schedule-1712000000000",
  "keywords": ["best running shoes", "shoe care tips"],
  "times": ["08:00", "14:00", "20:00"]
}
```

---

## How It Works

1. **Scheduling**: When you start a scheduled job, the system creates cron tasks for each specified time (e.g., 8:00 AM, 12:00 PM, 6:00 PM)
2. **Random Keyword Selection**: At each scheduled time, a random keyword from your list is selected
3. **Blog Generation**: The `/api/generate` endpoint is called to create a new blog post with the selected keyword
4. **Shopify Posting**: The blog and associated image are automatically uploaded to Shopify
5. **Job Management**: Each job has a unique ID that you can use to stop the scheduling at any time

---

## Environment Variables (Optional)

If you want to avoid passing Shopify credentials in each request, set these in your `.env.local`:

```env
SHOPIFY_API_TOKEN=shpat_xxxxx
SHOPIFY_SHOP=your-shop.myshopify.com
SHOPIFY_BLOG_ID=12345
```

Then you can call the endpoint with just keywords:
```json
{
  "keywords": ["best running shoes", "shoe care tips"],
  "times": ["08:00", "14:00", "20:00"]
}
```

---

## Customization

### Change Daily Posting Times
Modify the `times` parameter. Example for posting at 6 AM, 12 PM, and 9 PM:
```json
{
  "keywords": ["running shoes"],
  "times": ["06:00", "12:00", "21:00"]
}
```

### Post More Than 3 Times Per Day
Just add more times to the array:
```json
{
  "keywords": ["running shoes"],
  "times": ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"]
}
```

### Use Different Keywords for Different Times
Currently, keywords are randomly selected. To use specific keywords at specific times, you can create multiple scheduled jobs.

---

## Troubleshooting

- **Job not running?** Make sure your server is running (`npm run dev`)
- **Cron times not working?** Verify your server's timezone. The times are based on your server's local time.
- **Shopify errors?** Check that your Shopify token, shop name, and blog ID are correct
- **Stopping a job gives "not found" error?** The job ID might have expired or the server restarted (jobs are stored in memory)

---

## Notes

- Scheduled jobs are stored in memory. If the server restarts, active jobs will be lost.
- For production use, consider storing jobs in a database for persistence across server restarts.
- Each blog post includes internal links to Odysshoes as per the original generate.js logic.
