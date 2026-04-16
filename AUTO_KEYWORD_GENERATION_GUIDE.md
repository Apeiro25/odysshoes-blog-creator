# Auto Keyword Generation & Duplicate Prevention Guide

## Overview

The system now automatically generates keywords before starting scheduled posting jobs. This eliminates manual keyword input and prevents duplicate content by checking all previously published blogs.

---

## ✅ Changes Implemented

### 1. Removed Manual Keyword Input (UI Update)
**File:** `pages/index.js`
- Keywords input field is now **hidden** in Schedule mode
- Users see a helpful tip: "💡 Keywords will be automatically generated and checked against previously published blogs"
- Button now shows "🚀 Start Auto-Posting" instead of generic text
- Loading state shows "⏳ Starting Auto-Posting..."

### 2. Database Functions for Duplicate Prevention
**File:** `utils/supabaseClient.js` - New `publishedBlogsDatabase` object

**Functions added:**
- `getUsedKeywords()` - Retrieves all keywords from published_blogs table
  - Returns unique keywords that have already been used
  - Prevents generation of duplicate keywords
  - Returns empty array if table doesn't exist yet (graceful fallback)

- `addPublishedBlog(jobId, keyword, blogData)` - Logs newly published blogs
  - Stores keyword, title, metadata, and Shopify post ID
  - Enables future duplicate prevention

### 3. Auto-Generation Logic in Schedule API
**File:** `pages/api/schedule-posting.js`

**New Flow:**
```
1. Check if keywords array is empty (no manual keywords provided)
2. If empty:
   a. Query published_blogs table for already-used keywords
   b. Use generateKeywords() to create 20 new keywords
   c. Pass used keywords to avoid duplicates
   d. Return error if generation fails
3. If keywords provided manually, proceed as before
4. Create scheduled posting job with generated/provided keywords
```

**Key Code:**
```javascript
// Auto-generate keywords if not provided
if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
  const usedKeywords = await publishedBlogsDatabase.getUsedKeywords();
  const generatedKeywords = await generateKeywords(
    ["custom shoes", "personalized shoes", "handmade shoes"],
    usedKeywords,
    "shoes and customization",
    20 // Generate 20 keywords upfront
  );
  keywords = generatedKeywords;
}
```

---

## 🎯 How It Works

### User Flow - Before (Manual):
1. User enters keywords in UI ❌
2. User enters posting times
3. Click "Schedule"
4. System creates job with keywords
5. Risk: Same keywords posted multiple times = duplicate content

### User Flow - After (Automatic):
1. User sets posting times only (no keyword input needed)
2. Click "🚀 Start Auto-Posting"
3. System checks published_blogs table
4. System generates NEW keywords (avoiding already-used ones)
5. System creates job with auto-generated keywords
6. Result: Completely fresh, non-duplicate content! ✨

### Example:
```
Already Published Keywords:
- "custom shoe design trends"
- "personalized sneaker care"
- "handmade shoe craftsmanship"

Generated (New Keywords):
- "how to customize shoes at home"
- "best materials for custom shoes"
- "personalized athletic shoe fitting"
- ... (17 more unique keywords)
```

---

## 📊 Data Flow Diagram

```
Schedule Button Clicked
         ↓
Check if keywords provided
         ↓
    ┌─ NO(empty) ─┐
    │              YES → Use provided keywords
    ↓
Query published_blogs
for used keywords
    ↓
Call generateKeywords()
with used keywords list
    ↓
AI generates 20 new keywords
    ↓
Create scheduled job
with new keywords
    ↓
Job starts posting at
configured times
```

---

## 🔄 Integration Points

### 1. Blog Generation (`pages/api/generate.js`)
When a blog is posted, it should call:
```javascript
await publishedBlogsDatabase.addPublishedBlog(jobId, keyword, {
  title: blogData.title,
  slug: blogData.slug,
  imageUrl: blogData.imageUrl,
  metaDescription: blogData.metaDescription,
  contentPreview: blogData.intro,
  shopifyPostId: shopifyResult.article?.id
});
```

**Next Step:** Update `generateAndPostBlog()` in schedule-posting.js to log published blogs

### 2. Keyword Generator (`utils/keywordGenerator.js`)
Already accepts `usedKeywords` parameter to filter out duplicates:
```javascript
generateKeywords(
  initialKeywords,      // ["custom shoes", ...]
  usedKeywords,         // ["already published keyword", ...]
  niche,                // "shoes and customization"
  count                 // 20
)
```

---

## 🎁 Additional Improvements to Implement

### Priority 1: Critical (Do Next)
These complete the auto-generation feature:

1. **Log Published Blogs to Database** ⏳
   - Call `publishedBlogsDatabase.addPublishedBlog()` after Shopify posting succeeds
   - Update: `pages/api/schedule-posting.js` in `generateAndPostBlog()` function
   - Impact: Ensures future keyword generation avoids recent posts

2. **Keyword Similarity Checking** ⏳
   - Prevent keywords like "custom shoes" and "customize shoes" in same job
   - Add fuzzy matching in keyword generator
   - Impact: More diverse content strategy

3. **Job Response Enhancement** ⏳
   - Return generated keywords in API response
   - Show in confirmation alert so user knows what's being posted
   - Already partially done (show count in alert)

### Priority 2: Important (Useful)
These improve the overall experience:

4. **Keyword Exhaustion Handling**
   - When all 20 keywords are posted, auto-generate new batch
   - Add alert: "Auto-generating new keywords for continued posting..."
   - Prevent job from stopping when keywords run out

5. **Job Progress Dashboard**
   - Show keyword rotation stats in active jobs display
   - Display: Keywords total, Posted, Remaining
   - Show estimated time to complete all keywords

6. **Auto-Retry for Failed Generations**
   - If keyword generation fails, retry up to 3 times
   - Use exponential backoff
   - Alert user if all retries fail

7. **Keyword Configuration UI**
   - Let users set:
     - Initial reference keywords (default: shoes-related)
     - Number of keywords to generate (default: 20)
     - Niche/topic (default: "shoes and customization")
   - API already supports all these params

8. **Batch Keyword Generation Upfront**
   - Generate all 20 keywords at job start (already done ✓)
   - Rather than generating one at a time
   - Benefit: Prevents rate limits from AI, consistent quality

### Priority 3: Enhancement (Nice-to-have)
These add polish:

9. **Performance Metrics Dashboard**
   - Most popular keywords (most successful blogs)
   - Average time-to-publish
   - Content quality scores
   - Click/engagement tracking from Shopify

10. **Pause & Resume Jobs**
    - Pause job without stopping it permanently
    - Resume later without losing progress
    - Useful for maintenance windows

11. **Manual Keyword Override**
    - Advanced mode: Optionally input keywords if desired
    - Fallback to auto-generation if blank
    - Checkbox: "❌ Skip auto-generation, use my keywords"

12. **Smart Linking Optimization**
    - Track which keywords generate best internal linking opportunities
    - Optimize SEO based on keyword patterns
    - Report link density per keyword

---

## 📋 Implementation Checklist

- [ ] **Priority 1.1** - Update `generateAndPostBlog()` to call `publishedBlogsDatabase.addPublishedBlog()`
  - File: `pages/api/schedule-posting.js`
  - Lines: ~30-45
  - Impact: Ensures duplicate prevention works correctly

- [ ] **Priority 1.2** - Add similarity checking to `keywordGenerator.js`
  - Add function to calculate keyword similarity (Levenshtein distance)
  - Filter out similar keywords during generation
  
- [ ] **Priority 1.3** - Enhance API response with keyword details
  - Return `generatedKeywords` array in response
  - Return `uniqueKeywordsCount` to avoid confusion

- [ ] **Priority 2.1** - Implement keyword exhaustion handler
  - Check in cron job if all keywords posted
  - Auto-generate new batch before stopping

- [ ] **Priority 2.2** - Build job progress dashboard
  - Add section in jobs display
  - Show real-time keyword rotation stats

- [ ] **Priority 2.3** - Add auto-retry logic with exponential backoff
  - Wrap keyword generation in retry loop
  - Max 3 attempts with 5s, 10s, 20s delays

---

## 🧪 Testing Recommendations

### Test Case 1: Happy Path
- [ ] No published blogs exist
- [ ] Click "Start Auto-Posting"
- [ ] Verify 20 keywords generated
- [ ] Confirm job starts successfully
- [ ] Check logs for "Auto-generated 20 keywords"

### Test Case 2: Duplicate Avoidance
- [ ] Manually create published blog with keyword: "custom shoes"
- [ ] Click "Start Auto-Posting"
- [ ] Verify generated keywords do NOT include "custom shoes"
- [ ] Confirm "Avoiding 1 already-published keywords" in logs

### Test Case 3: Manual Keywords (Backward Compatibility)
- [ ] Enter keywords manually (comma-separated)
- [ ] Set times and click "Start Auto-Posting"
- [ ] Verify system uses manual keywords, NOT auto-generation
- [ ] Ensure backward compatibility maintained

### Test Case 4: Error Handling
- [ ] Disable database access
- [ ] Click "Start Auto-Posting"
- [ ] Verify graceful error: "Failed to auto-generate keywords"
- [ ] Check error message includes details

### Test Case 5: Time Configuration
- [ ] Set custom posting times: "08:00,14:00,20:00" (3 times daily)
- [ ] Verify job respects custom times
- [ ] Test with different formats (single time, multiple, invalid)

---

## 💾 Database Setup (Already Done ✓)

The `published_blogs` table should exist with:
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
  generated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(job_id, keyword),
  CONSTRAINT fk_job FOREIGN KEY (job_id) 
    REFERENCES scheduled_jobs(id) ON DELETE RESTRICT
);
```

If missing, see `PUBLISHED_BLOGS_SETUP.md` for full setup.

---

## 🚀 Deployment Steps

1. **Deploy files:**
   - `pages/api/schedule-posting.js` (auto-generation logic)
   - `pages/index.js` (UI changes)
   - `utils/supabaseClient.js` (database functions)

2. **Test on staging:**
   - Run test cases above
   - Verify no regressions

3. **Production deployment:**
   - Monitor first 5 jobs for successful auto-generation
   - Check logs for keyword generation stats
   - Verify published_blogs table filling correctly

4. **Post-deployment:**
   - Implement Priority 1.1 (logging published blogs)
   - Add similarity checking for keywords
   - Build job dashboard

---

## 📝 Configuration for Different Niches

To adjust for different business types, modify `generateKeywords()` call in schedule-posting.js:

### Example 1: Fashion/Clothing
```javascript
generateKeywords(
  ["sustainable fashion", "eco-friendly clothing", "ethical manufacturing"],
  usedKeywords,
  "sustainable and ethical fashion",
  20
)
```

### Example 2: Technology
```javascript
generateKeywords(
  ["AI tools", "software development", "cloud computing"],
  usedKeywords,
  "modern technology and development",
  20
)
```

### Example 3: Fitness
```javascript
generateKeywords(
  ["home workouts", "fitness routines", "health tips"],
  usedKeywords,
  "fitness and wellness",
  20
)
```

---

## ❓ FAQ

**Q: What if published_blogs table doesn't exist?**
A: The system gracefully returns an empty array, so auto-generation still works. Create the table when ready.

**Q: Can I still manually input keywords?**
A: Yes! Leave keywords empty for auto-generation, or provide keywords manually. Manual keywords take priority.

**Q: How many keywords are generated?**
A: Currently 20 keywords per job start. Configurable in `schedule-posting.js` line ~77.

**Q: What's the initial reference keywords?**
A: Default is `["custom shoes", "personalized shoes", "handmade shoes"]`. Change in `schedule-posting.js` for different niches.

**Q: Why 20 keywords?**
A: ~4 posts per day = 5 days of unique content. Adjust based on posting frequency.

**Q: Can I change posting times after job starts?**
A: Current system requires stopping and restarting the job. Future enhancement: Dynamic schedule adjustment.

---

## 📞 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Failed to auto-generate keywords" | AI API error or rate limit | Check OpenAI API key and rate limits |
| Keywords still duplicate | `getUsedKeywords()` not working | Verify `published_blogs` table exists and has data |
| Job doesn't start | Keywords generation failed | Check logs for specific error message |
| Same keywords every time | Similarity checking not implemented | Priority 1.2 will fix this |
| Job stops after 20 posts | Keywords exhausted | Priority 2.1 will auto-renew keywords |

---

**Last Updated:** April 17, 2026
**Status:** ✅ Core feature complete, Priority 1 enhancements pending
