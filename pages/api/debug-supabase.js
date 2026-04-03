import { jobDatabase } from "../../utils/supabaseClient.js";

export default async function handler(req, res) {
  try {
    console.log("[DEBUG] Testing Supabase connection...");
    const jobs = await jobDatabase.getAllJobs();
    console.log("[DEBUG] Jobs from Supabase:", jobs);
    
    return res.status(200).json({
      message: "Debug info",
      jobsFromSupabase: jobs,
      jobCount: jobs ? jobs.length : 0
    });
  } catch (error) {
    console.error("[DEBUG] Error:", error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}
