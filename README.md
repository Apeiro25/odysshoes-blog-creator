# Blog Generator

This project generates SEO-optimized blogs using AI. It includes features for automatic content generation, competitor blog scraping, AI-generated visuals, and advanced SEO optimization. Built with Next.js and deployed on Vercel.

## Features

### Core Blog Generation
- **AI-Powered Content Creation** - Uses OpenAI GPT-4 to generate 2000+ word SEO-optimized blogs
- **Automatic AI-Generated Visuals** - Google Gemini (Nano Banana) creates relevant images
- **Automatic Shopify Image Uploads** - Generated images are uploaded directly to your Shopify account
- **Multi-Keyword Support** - Generate multiple blogs in one batch

### Content Scraping & Repurposing
- **Competitor Blog Scraping** - Analyze competitor blog posts
- **Unique Content Generation** - AI creates completely original content based on competitor research
- **Content Attribution** - Automatically links to original source
- **Link Extraction** - Identifies and catalogs external/internal links from sources

### SEO Optimization (Full Suite)
- **Smart Internal Linking** - Automatically fetches your Shopify collections & products
  - Discovers all your store's collections and top 50 products
  - Intelligently matches content keywords to your product/collection pages
  - Creates keyword variations (plurals, "buy", "shop", "custom" prefixes)
  - Inserts up to 8 contextual links per blog post
  - Maintains optimal link density (1-2%)
  - Caches Shopify data for 1 hour to avoid repeated API calls
- **Automatic Keyword Research** - Identifies related keywords for internal linking
- **Link Density Analysis** - Analyzes and reports link density metrics
- **SEO Metadata Generation** - Creates optimized titles, meta descriptions, and keywords
- **SEO Score Calculation** - Rates blog posts on SEO effectiveness (0-100)
- **Link Opportunity Analysis** - Reports which keywords had linking opportunities

### Additional Features
- **FAQ Schema Markup** - Automatically generates structured FAQ data
- **Meta Descriptions** - Generates search engine-optimized meta descriptions
- **Author Attribution** - Tags posts with author information
- **Instant Publishing** - Automatically publishes to Shopify blog

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
SHOPIFY_API_TOKEN=your_shopify_api_token
SHOPIFY_SHOP=your_store.myshopify.com
SHOPIFY_BLOG_ID=your_blog_id
```

The Gemini API key is used to generate AI images for blog posts using the Nano Banana free tier. Shopify credentials are pre-configured in environment variables for seamless operation.

## User Interface

The application has **two operating modes** accessed via toggle buttons:

### Mode 1: ✨ Generate Blog (Default)
Create completely new, original blog posts from scratch.
- **Inputs**: Keywords (comma-separated) + Author Name
- **Output**: SEO-optimized blog with AI-generated image
- **Example**: Enter "coffee brewing,espresso" to generate 2 blogs

### Mode 2: 🔍 Scrape & Repurpose
Analyze competitor blogs and generate unique variations from multiple sources.
- **Inputs**: Competitor Blog URLs (comma-separated) + Author Name + Keywords (optional)
- **Output**: Original content inspired by competitor research (synthesized from all sources)
- **Features**: 
  - Extracts content from multiple competitor sources
  - Auto-detects main keywords if not provided
  - Uses AI to create completely unique content combining insights from all sources
  - Includes attribution to original sources
  - Maintains topic relevance with your keywords

## Development

1. Install dependencies:
   ```sh
   npm install
   ```

2. Run the development server:
   ```sh
   npm run dev
   ```

3. Build for production:
   ```sh
   npm run build
   ```

4. Start the production server:
   ```sh
   npm start
   ```

## Scheduled Blog Posting (✨ Now on Supabase!)

The application supports automated, scheduled blog posting to Shopify. **Jobs are now persistent in Supabase Cloud Database** and work 24/7 on Vercel!

### Key Features
- ✅ **Cloud Persistence** - Jobs persist in Supabase (survive restarts, deploys, shutdowns)
- ✅ **24/7 on Vercel** - Works automatically, no laptop needed
- ✅ **Free Tier** - Supabase free plan is plenty for your needs
- ✅ **Auto-Restoration** - Jobs automatically restore after server restart
- ✅ **Easy Management** - API endpoints to check status and manage jobs

### Scheduling Blogs
- Use `/api/schedule-posting` to create scheduled posting jobs
- Specify keywords, posting times (HH:MM format), and Shopify credentials
- Blogs are automatically generated and posted at scheduled times
- Jobs are saved to Supabase and restore automatically

### Managing Scheduled Jobs
- **View status**: `GET /api/job-restore` - See all active jobs
- **Restore jobs**: `POST /api/job-restore?action=restore` - Manually trigger restoration
- **Stop jobs**: Use `/api/stop-posting` with the job ID

### Database
Jobs are stored in Supabase (`scheduled_jobs` table) with:
- Job ID, keywords, posting times
- Shopify store credentials
- Creation timestamp

**See [JOB_PERSISTENCE_GUIDE.md](JOB_PERSISTENCE_GUIDE.md)** for complete setup and usage instructions.

## How It Works

### Complete Blog Generation Pipeline

1. **Image Generation**: 
   - Uses Google Gemini API to create a detailed image description based on blog keywords
   - Fetches a high-quality image from Unsplash matching the topic

2. **Image Upload to Shopify**:
   - Downloads the image and converts it to base64
   - Uploads to your Shopify account using the Files API
   - Receives a permanent Shopify asset URL

3. **Blog Content Generation** (Using OpenAI GPT-4):
   - **Prompt**: The system uses an optimized OpenAI prompt that instructs GPT-4 to:
     - Create 2000+ word SEO-optimized blog posts
     - Structure content with clear H2 headings
     - Research top 5 Google results for comprehensive coverage
     - Generate 5+ FAQs with answers
     - Add product links automatically (customize shoes, basketball shoes)
   - **Customization**: You can modify the prompt in `/pages/api/generate.js` (lines ~215-245) if needed
   - The prompt is **still necessary** - it tells GPT-4 exactly how to format and structure your blogs
   - Default prompt is industry-tested and optimized for shoe blogs

4. **Smart Internal Linking** (Automatic):
   - **Fetches Your Store**: Dynamically grabs all your Shopify collections and products
   - **Builds Link Database**: Creates keyword variations and URL mappings
   - **Smart Matching**: Intelligently identifies link opportunities in blog content
   - **Auto-Inserts**: Adds up to 8 contextual links without over-linking
   - **Data Caching**: Caches Shopify data for 1 hour to optimize performance

5. **Link Density Analysis**:
   - Checks link ratios and provides recommendations
   - Ensures optimal SEO (1-2% link density)

6. **SEO Metadata Generation**:
   - Calculates keyword density percentage
   - Checks keyword presence in title and content
   - Generates SEO scores (0-100)

7. **Automatic Publishing**:
   - Embeds the Shopify-hosted image in the blog post
   - Inserts all internal links automatically
   - Publishes everything to your Shopify blog automatically
   - Includes schema markup for FAQs and rich snippets

### Competitor Blog Scraping Pipeline

1. **Fetch & Extract**: Downloads competitor blog content
2. **Content Analysis**: Extracts title, body paragraphs, and links
3. **Unique Generation**: AI rewrites content to be completely original
4. **Internal Optimization**: Adds your keyword-specific internal links
5. **Publish**: Posts to Shopify with full attribution to source

## API Endpoints

### `/api/generate` - Generate Blog from Scratch
```bash
POST /api/generate
Content-Type: application/json

{
  "keyword": "coffee brewing techniques",
  "author": "John Doe"
}

Response: {
  "success": true,
  "blog": { /* full blog object */ },
  "seo": { 
    "metadata": { /* SEO metrics */ },
    "linkAnalysis": { /* link statistics */ }
  },
  "shopifyResponse": { /* Shopify publish confirmation */ }
}
```

### `/api/scrape-competitor` - Scrape & Repurpose
```bash
POST /api/scrape-competitor
Content-Type: application/json

{
  "competitorUrl": "https://example.com/blog/coffee-guide",
  "keywords": "coffee brewing",
  "author": "Jane Smith"
}

Response: {
  "success": true,
  "scrapedSource": { /* source information */ },
  "generatedBlog": { /* original AI-written blog */ },
  "seo": { /* SEO metrics */ },
  "shopifyResponse": { /* Shopify confirmation */ }
}
```

## Advanced Configuration

### Smart Linking (Automatic - No Setup Required!)

Smart linking **automatically fetches your Shopify store structure** and creates intelligent internal links. No configuration needed!

**How It Works:**
1. System fetches all your Shopify collections and top 50 products
2. Creates keyword database with URL mappings
3. Generates variations: plural forms, action prefixes ("buy", "shop", "custom")
4. Intelligently inserts up to 8 links per blog post
5. Maintains optimal link density (1-2%)
6. **Caches results for 1 hour** to optimize API usage

**Features:**
- ✅ Dynamically uses all your collections
- ✅ Links to products and collections
- ✅ Auto-generates keyword variations
- ✅ Avoids duplicate/broken links
- ✅ Reports opportunities found

### Customizing the OpenAI Blog Prompt

The blog generation prompt is in `/pages/api/generate.js` (lines ~215-245).

**The Prompt is Still Necessary!** It tells GPT-4:
- Create 2000+ word blogs
- Structure with H2 headings
- Research top Google results
- Generate 5+ FAQs
- Add Odysshoes product links
- Maintain SEO best practices

**To Modify:**
1. Open `/pages/api/generate.js`
2. Find the `const prompt = \`...` section
3. Edit instructions as needed
4. Redeploy

## Project Structure

```
pages/
├── index.js                    # Main UI with dual-mode interface
└── api/
    ├── generate.js             # Blog generation with SEO
    └── scrape-competitor.js    # Competitor scraping endpoint

utils/
├── seoUtils.js                # SEO optimization functions
├── scraperUtils.js            # Web scraping utilities
└── smartLinking.js            # Smart internal linking from Shopify store

styles/
└── Home.module.css             # UI styles

.env.local                      # API credentials and Shopify config
```

Ensure your Shopify API token has these **scopes**:
- ✅ `write_files` - Required to upload images
- ✅ `read_files` - Required to retrieve image URLs
- ✅ `write_articles` - Required to publish blog posts
- ✅ `read_articles` - Required to manage articles

### How to Update Scopes:
1. Go to **Shopify Admin** → **Settings** → **Apps and integrations**
2. Click **Develop apps** → Select your app
3. Go to **Configuration** tab
4. Enable required scopes under **Admin API access scopes**
5. Click **Save** and **Reinstall** if needed
6. Copy your updated **Access Token**

## SEO Automation Details

### Internal Linking Strategy
The system automatically creates internal links using a keyword database:

**Keyword-to-URL Mappings:**
- "customize shoes" → `/collections/custom-shoes`
- "custom basketball shoes" → `/collections/custom-basketball-shoes`
- "shoe personalization" → `/collections/custom-shoes`
- And more topic-specific variations...

**Auto-Linking Features:**
- Detects related keywords in blog content
- Inserts up to 5 contextual internal links
- Avoids over-linking (maintains 1-2% link density)
- Links inserted naturally in intro, body, and conclusion sections

### Featured Metrics
Each blog includes SEO analysis:
- **SEO Score**: 0-100 rating based on keyword optimization
- **Link Density**: Percentage of links relative to total words
- **Keyword Presence**: Whether keyword appears in title and content
- **Keyword Density**: Percentage of target keyword usage
- **Word Count**: Total article length

### Example Output
```json
{
  "seo": {
    "metadata": {
      "title": "Best Coffee Makers for Home Brewing",
      "keyword": "coffee makers",
      "keywordDensity": "1.85%",
      "wordCount": 2847,
      "seoScore": 82
    },
    "linkAnalysis": {
      "totalWords": 2847,
      "linkCount": 4,
      "linkDensity": "0.14%",
      "recommendation": "Optimal link density"
    }
  }
}
```