import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { restoreActiveJobs } from './utils/jobRestoration.js';
import { jobManager } from './utils/jobManager.js';

// Initialize server with job restoration
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const startup = async () => {
  try {
    await app.prepare();
    
    // Load jobs from Supabase and restore cron tasks
    console.log("Starting server initialization...");
    console.log("Loading jobs from Supabase...");
    await jobManager.loadJobsFromDatabase();
    
    // Restore the cron tasks
    await restoreActiveJobs();
    
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal server error');
      }
    }).listen(3000, (err) => {
      if (err) throw err;
      console.log('> Ready on http://localhost:3000');
    });
  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
};

startup();
