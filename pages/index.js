import Head from 'next/head';
import styles from '../styles/Home.module.css';
import React, { useState, useEffect } from 'react';

export default function Home() {
  const [keywords, setKeywords] = useState('');
  const [author, setAuthor] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [mode, setMode] = useState('generate'); // 'generate', 'scrape', or 'schedule'
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedBlogs, setSavedBlogs] = useState([]);
  const [showBlogs, setShowBlogs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [shopifyToken, setShopifyToken] = useState('');
  const [shopifyShop, setShopifyShop] = useState('');
  const [shopifyBlogId, setShopifyBlogId] = useState('');
  const [scheduleTimes, setScheduleTimes] = useState('06:00,09:00,12:00,15:00,18:00');
  const [activeJobs, setActiveJobs] = useState([]);
  const [showActiveJobs, setShowActiveJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [jobLogs, setJobLogs] = useState(null);
  const [showJobLogs, setShowJobLogs] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState({
    odysshoesConnected: false,
    publishedBlogsCount: 0,
    duplicateCheckActive: false,
    linkingActive: false,
  });
  const [schedulingStatus, setSchedulingStatus] = useState({
    isChecking: false,
    checkingMessage: '',
    blogsLinked: 0,
    keywordsGenerated: 0,
    duplicatesSkipped: 0,
  });

  useEffect(() => {
    // Load saved blogs from local storage
    const blogs = JSON.parse(localStorage.getItem('savedBlogs')) || [];
    setSavedBlogs(blogs);
    
    // Load Shopify credentials from local storage
    const token = localStorage.getItem('shopifyToken') || '';
    const shop = localStorage.getItem('shopifyShop') || '';
    const blogId = localStorage.getItem('shopifyBlogId') || '';
    
    setShopifyToken(token);
    setShopifyShop(shop);
    setShopifyBlogId(blogId);

    // Fetch active jobs on component mount
    fetchActiveJobs();
  }, []);

  const fetchActiveJobs = async () => {
    try {
      const response = await fetch('/api/stop-posting');
      const data = await response.json();
      if (data.activeJobs) {
        setActiveJobs(data.activeJobs);
      }
    } catch (err) {
      console.log('No active jobs or error fetching:', err.message);
    }
  };

  const fetchJobLogs = async (jobId) => {
    try {
      const response = await fetch(`/api/job-logs?jobId=${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setJobLogs(data);
        setShowJobLogs(true);
      } else {
        alert('Failed to fetch job logs');
      }
    } catch (err) {
      console.error('Error fetching job logs:', err);
      alert('Error fetching job logs');
    }
  };

  const inputStyle = {
    padding: '0.5rem',
    width: '100%',
    marginBottom: '1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
  };

  const cardStyle = {
    padding: '2rem',
    border: '1px solid #ddd',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    backgroundColor: '#fff',
    fontFamily: 'Arial, sans-serif',
  };

  const centeredContainer = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  };

  const saveBlog = (blog) => {
    const updatedBlogs = [...savedBlogs, blog];
    setSavedBlogs(updatedBlogs);
    localStorage.setItem('savedBlogs', JSON.stringify(updatedBlogs));
  };

  const generateSlug = (title) => {
    return title
      .toLowerCase() // Convert to lowercase
      .trim() // Remove whitespace from both ends
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric characters with dashes
      .replace(/^-+|-+$/g, ''); // Remove leading or trailing dashes
  };

  const saveShopifyCredentials = () => {
    localStorage.setItem('shopifyToken', shopifyToken);
    localStorage.setItem('shopifyShop', shopifyShop);
    localStorage.setItem('shopifyBlogId', shopifyBlogId);
    alert('Shopify credentials saved!');
    setShowSettings(false);
  };

  const scheduleBlogs = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSchedulingStatus({
      isChecking: true,
      checkingMessage: '🔍 Connecting to odysshoes.com/blogs/news...',
      blogsLinked: 0,
      keywordsGenerated: 0,
      duplicatesSkipped: 0,
    });

    try {
      const timeList = scheduleTimes.split(',').map((t) => t.trim()).filter(t => t);

      // Update status
      setSchedulingStatus(prev => ({
        ...prev,
        checkingMessage: '📊 Checking published blogs for duplicates...'
      }));

      // Wait a moment to show status update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Keywords will be auto-generated on the server, so we don't need to validate them here
      const response = await fetch('/api/schedule-posting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: [], // Empty array - server will auto-generate
          times: timeList,
          shopifyToken,
          shopifyShop,
          shopifyBlogId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to schedule blogs');
      }

      const data = await response.json();
      setContent(null);
      
      // Update status with results
      const keywordCount = data.keywords?.length || 0;
      const duplicateCount = data.duplicatesSkipped || 0;
      const linkedCount = data.blogsLinked || 0;
      
      setSchedulingStatus({
        isChecking: false,
        checkingMessage: '✓ Setup complete!',
        blogsLinked: linkedCount,
        keywordsGenerated: keywordCount,
        duplicatesSkipped: duplicateCount,
      });

      // Build timezone info message
      let timezoneMessage = '';
      if (data.scheduledTimesInfo && data.scheduledTimesInfo.length > 0) {
        timezoneMessage = '\n\n🌏 Posting Schedule (Timezone Conversion):\n';
        data.scheduledTimesInfo.forEach((info, idx) => {
          timezoneMessage += `  ${idx + 1}. ${info.phtTime} PHT → ${info.serverTime} ${info.serverTimezone}\n`;
        });
      }

      alert(`✓ Scheduled! Job ID: ${data.jobId}\n\n📝 Auto-generated ${keywordCount} keywords!\n${duplicateCount > 0 ? `⛔ Skipped ${duplicateCount} duplicates\n` : ''}${linkedCount > 0 ? `🔗 Ready to link to ${linkedCount} existing blogs\n` : ''}⏰ Blogs will post at: ${timeList.join(', ')} PHT${timezoneMessage}`);
      setScheduleTimes('06:00,09:00,12:00,15:00,18:00');
      
      // Refresh active jobs list
      await fetchActiveJobs();
    } catch (err) {
      setError(err.message);
      setSchedulingStatus({
        isChecking: false,
        checkingMessage: '❌ Setup failed',
        blogsLinked: 0,
        keywordsGenerated: 0,
        duplicatesSkipped: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const stopScheduledJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to stop this scheduled posting job?')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/stop-posting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        throw new Error('Failed to stop scheduled job');
      }

      const data = await response.json();
      alert(`✓ Scheduled posting job stopped successfully!\n\n${data.note}`);
      setSelectedJobId('');
      
      // Refresh active jobs list
      await fetchActiveJobs();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateBlog = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setContent(null);

    // Validation based on mode
    if (mode === 'generate' && (!keywords || !author)) {
      setError('Keywords and Author name are required.');
      setLoading(false);
      return;
    }

    if (mode === 'scrape' && (!competitorUrl || !author)) {
      setError('Competitor URLs and Author name are required. Keywords are optional.');
      setLoading(false);
      return;
    }

    try {
      let endpoint = '/api/generate';
      let body = {};

      if (mode === 'generate') {
        const keywordList = keywords.split(',').map((kw) => kw.trim());
        const generatedBlogs = [];

        for (const keyword of keywordList) {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              keyword, 
              author,
              shopifyToken,
              shopifyShop,
              shopifyBlogId
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to generate blog for keyword: ${keyword}`);
          }

          const data = await response.json();
          generatedBlogs.push(data.blog);
        }

        setContent(generatedBlogs);
        setSavedBlogs((prev) => [...prev, ...generatedBlogs]);
        localStorage.setItem('savedBlogs', JSON.stringify([...savedBlogs, ...generatedBlogs]));
      } else if (mode === 'scrape') {
        endpoint = '/api/scrape-competitor';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            competitorUrls: competitorUrl.split(',').map(url => url.trim()).filter(url => url),
            keywords, 
            author,
            shopifyToken,
            shopifyShop,
            shopifyBlogId
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.details || 'Failed to scrape and generate blog from competitor');
        }

        setContent([data.generatedBlog]);
        setSavedBlogs((prev) => [...prev, data.generatedBlog]);
        localStorage.setItem('savedBlogs', JSON.stringify([...savedBlogs, data.generatedBlog]));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>📝 Blog Creator & Scheduler</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>Generate, scrape, or schedule blog posts with AI</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            style={{
              padding: '0.7rem 1.2rem',
              backgroundColor: '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            ⚙️ Settings
          </button>
        </div>

        {/* Main Container */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: mode === 'schedule' ? '1fr 1fr' : '1fr',
          gap: '2rem',
          maxWidth: '100%',
        }}>
          {/* Left Column - Input Form */}
          <div style={cardStyle}>

        {showSettings && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
            border: '2px solid #0070f3',
            borderRadius: '8px',
            backgroundColor: '#f0f7ff',
          }}>
            <h3 style={{ marginTop: 0, color: '#0070f3' }}>🔐 Shopify Configuration</h3>
            <input
              type="text"
              placeholder="Shopify API Token"
              value={shopifyToken}
              onChange={(e) => setShopifyToken(e.target.value)}
              style={{...inputStyle, fontFamily: 'monospace', fontSize: '12px'}}
            />
            <input
              type="text"
              placeholder="Shop Name (e.g., odysshoes.myshopify.com)"
              value={shopifyShop}
              onChange={(e) => setShopifyShop(e.target.value)}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Blog ID"
              value={shopifyBlogId}
              onChange={(e) => setShopifyBlogId(e.target.value)}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={saveShopifyCredentials}
              style={{
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                padding: '0.7rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                width: '100%',
                fontWeight: 'bold',
                fontSize: '14px',
              }}
            >
              💾 Save Credentials
            </button>
            {shopifyToken && shopifyShop && shopifyBlogId && (
              <p style={{ color: '#28a745', marginTop: '0.8rem', fontSize: '13px', fontWeight: 'bold' }}>✓ Credentials configured</p>
            )}
          </div>
        )}
        {/* Mode Selection */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.8rem 0', fontSize: '13px', fontWeight: 'bold', color: '#666' }}>SELECT MODE:</p>
          <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setMode('generate')}
              style={{
                padding: '0.7rem 1.2rem',
                backgroundColor: mode === 'generate' ? '#0070f3' : '#e0e0e0',
                color: mode === 'generate' ? '#fff' : '#666',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                flex: '1',
                minWidth: '120px',
                transition: 'all 0.2s',
              }}
            >
              ✨ Generate
            </button>
            <button
              type="button"
              onClick={() => setMode('scrape')}
              style={{
                padding: '0.7rem 1.2rem',
                backgroundColor: mode === 'scrape' ? '#0070f3' : '#e0e0e0',
                color: mode === 'scrape' ? '#fff' : '#666',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                flex: '1',
                minWidth: '120px',
                transition: 'all 0.2s',
              }}
            >
              🔍 Scrape
            </button>
            <button
              type="button"
              onClick={() => setMode('schedule')}
              style={{
                padding: '0.7rem 1.2rem',
                backgroundColor: mode === 'schedule' ? '#0070f3' : '#e0e0e0',
                color: mode === 'schedule' ? '#fff' : '#666',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                flex: '1',
                minWidth: '120px',
                transition: 'all 0.2s',
              }}
            >
              ⏰ Schedule
            </button>
          </div>
        </div>

        <form onSubmit={mode === 'schedule' ? scheduleBlogs : generateBlog}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#333', fontSize: '16px' }}>
            {mode === 'generate' && '📝 Generate New Blog'}
            {mode === 'scrape' && '🔗 Scrape & Repurpose'}
            {mode === 'schedule' && '📅 Schedule Posting'}
          </h3>

          {/* Integration Status - Only in schedule mode */}
          {mode === 'schedule' && (
            <div style={{
              padding: '1rem',
              marginBottom: '1.5rem',
              border: '2px solid #0070f3',
              borderRadius: '8px',
              backgroundColor: '#f0f7ff',
            }}>
              <p style={{ margin: '0 0 0.8rem 0', fontSize: '13px', fontWeight: 'bold', color: '#0070f3' }}>🔗 SYSTEM INTEGRATIONS</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '16px' }}>🌐</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>Odysshoes.com</p>
                    <p style={{ margin: 0, color: '#666', fontSize: '11px' }}>Connected to /blogs/news</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '16px' }}>✓</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>Duplicate Check</p>
                    <p style={{ margin: 0, color: '#666', fontSize: '11px' }}>Phrase + Broad Match</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '16px' }}>🔗</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>Auto-Linking</p>
                    <p style={{ margin: 0, color: '#666', fontSize: '11px' }}>Dynamic phrase matching</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '16px' }}>⚙️</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>Smart Linking</p>
                    <p style={{ margin: 0, color: '#666', fontSize: '11px' }}>Max 5 links per blog</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scheduling Status - Shows during/after scheduling */}
          {mode === 'schedule' && schedulingStatus.isChecking && (
            <div style={{
              padding: '1rem',
              marginBottom: '1.5rem',
              border: '2px solid #ff9800',
              borderRadius: '8px',
              backgroundColor: '#fff8f0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '3px solid #ff9800',
                  borderTop: '3px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', color: '#ff9800', fontSize: '13px' }}>
                    {schedulingStatus.checkingMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Scheduling Results - Shows after scheduling completes */}
          {mode === 'schedule' && !schedulingStatus.isChecking && schedulingStatus.keywordsGenerated > 0 && (
            <div style={{
              padding: '1rem',
              marginBottom: '1.5rem',
              border: '2px solid #28a745',
              borderRadius: '8px',
              backgroundColor: '#f0fff4',
            }}>
              <p style={{ margin: '0 0 0.8rem 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>✓ SETUP SUMMARY</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', fontSize: '12px' }}>
                <div style={{ padding: '0.6rem 0.8rem', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d4edda' }}>
                  <p style={{ margin: 0, color: '#666', fontSize: '11px' }}>Keywords Generated</p>
                  <p style={{ margin: '0.3rem 0 0 0', fontWeight: 'bold', fontSize: '14px', color: '#28a745' }}>{schedulingStatus.keywordsGenerated}</p>
                </div>
                {schedulingStatus.duplicatesSkipped > 0 && (
                  <div style={{ padding: '0.6rem 0.8rem', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #ffeeba' }}>
                    <p style={{ margin: 0, color: '#666', fontSize: '11px' }}>Duplicates Skipped</p>
                    <p style={{ margin: '0.3rem 0 0 0', fontWeight: 'bold', fontSize: '14px', color: '#ff9800' }}>{schedulingStatus.duplicatesSkipped}</p>
                  </div>
                )}
                {schedulingStatus.blogsLinked > 0 && (
                  <div style={{ padding: '0.6rem 0.8rem', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #b3e5fc' }}>
                    <p style={{ margin: 0, color: '#666', fontSize: '11px' }}>Blogs to Link</p>
                    <p style={{ margin: '0.3rem 0 0 0', fontWeight: 'bold', fontSize: '14px', color: '#0070f3' }}>{schedulingStatus.blogsLinked}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Competitor URLs - Only shown in scrape mode */}
          {mode === 'scrape' && (
            <textarea
              placeholder="Competitor Blog URLs (comma-separated, e.g., https://example1.com/blog, https://example2.com/blog)"
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              style={{...inputStyle, minHeight: '90px', fontFamily: 'monospace', fontSize: '12px'}}
            />
          )}

          {/* Keywords Input - Hidden in schedule mode */}
          {mode !== 'schedule' && (
            <input
              type="text"
              placeholder={mode === 'generate' ? "Keywords (comma-separated)" : mode === 'scrape' ? "Blog Keywords (optional - auto-detected if left blank)" : "Keywords for scheduling (comma-separated)"}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              style={inputStyle}
            />
          )}

          {/* Schedule Times - Only shown in schedule mode */}
          {mode === 'schedule' && (
            <>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '13px', fontWeight: 'bold', color: '#666' }}>Posting Times in Philippines Time (UTC+8)</label>
              <input
                type="text"
                placeholder="HH:MM format, comma-separated (e.g., 06:00,09:00,12:00,15:00,18:00)"
                value={scheduleTimes}
                onChange={(e) => setScheduleTimes(e.target.value)}
                style={{...inputStyle, fontFamily: 'monospace', fontSize: '12px'}}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '0.5rem', fontStyle: 'italic' }}>
                🌏 Times are in Philippines Time (UTC+8). Example: 09:00 = 9:00 AM PHT
              </p>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '0.5rem', fontStyle: 'italic' }}>
                💡 Keywords will be automatically generated and checked against previously published blogs
              </p>
            </>
          )}

          {/* Author Name Input - Not shown in schedule mode */}
          {mode !== 'schedule' && (
            <input
              type="text"
              placeholder="Author Name"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              style={inputStyle}
            />
          )}

          <button
            type="submit"
            style={{
              padding: '0.8rem 1.2rem',
              backgroundColor: mode === 'schedule' ? '#28a745' : '#0070f3',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              width: '100%',
              fontWeight: 'bold',
              fontSize: '15px',
              transition: 'background-color 0.2s',
              opacity: loading ? 0.7 : 1,
            }}
            disabled={loading}
          >
            {loading ? (
              mode === 'schedule' ? '⏳ Starting Auto-Posting...' : '⏳ Processing...'
            ) : (
              mode === 'generate' ? '✨ Generate Blog' : 
              mode === 'scrape' ? '🔗 Scrape & Generate' : 
              '🚀 Start Auto-Posting'
            )}
          </button>
        </form>
        {error && <p style={{ color: '#dc3545', marginTop: '1rem', padding: '1rem', backgroundColor: '#f8d7da', borderRadius: '6px', borderLeft: '4px solid #dc3545' }}>{error}</p>}
        
        {/* Active Scheduled Jobs Section - Inline */}
        {mode === 'schedule' && (
          <div style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={() => {
                setShowActiveJobs(!showActiveJobs);
                if (!showActiveJobs) fetchActiveJobs();
              }}
              style={{
                padding: '0.7rem 1rem',
                backgroundColor: showActiveJobs ? '#ff9800' : '#e0e0e0',
                color: showActiveJobs ? '#fff' : '#333',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                width: '100%',
                fontWeight: 'bold',
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
            >
              {showActiveJobs ? '▼ Hide Active Jobs' : '▶ View Active Jobs'} {activeJobs.length > 0 && <span style={{ marginLeft: '0.5rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>({activeJobs.length})</span>}
            </button>

            {showActiveJobs && (
              <div style={{
                marginTop: '1.2rem',
                padding: '1.2rem',
                border: '2px solid #ff9800',
                borderRadius: '8px',
                backgroundColor: '#fff8f0',
              }}>
                {activeJobs.length > 0 ? (
                  <div>
                    {activeJobs.map((job) => (
                      <div key={job.jobId} style={{
                        marginBottom: '1.2rem',
                        padding: '1.2rem',
                        backgroundColor: '#fff',
                        border: '1px solid #ffe0b2',
                        borderRadius: '8px',
                        boxShadow: '0 2px 4px rgba(255, 152, 0, 0.1)',
                      }}>
                        {/* Job ID */}
                        <div style={{ marginBottom: '0.8rem', paddingBottom: '0.8rem', borderBottom: '1px solid #ffe0b2' }}>
                          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Job ID:</p>
                          <code style={{ fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '4px 6px', borderRadius: '4px', display: 'block', marginTop: '0.3rem', wordBreak: 'break-all' }}>{job.jobId}</code>
                        </div>
                        
                        {/* Keywords */}
                        <p style={{ margin: '0.6rem 0', fontSize: '13px' }}>
                          <strong>Keywords:</strong> {job.keywords.join(', ')}
                        </p>
                        
                        {/* Linked Blogs */}
                        {job.linkedBlogs && job.linkedBlogs.length > 0 && (
                          <p style={{ margin: '0.6rem 0', fontSize: '13px' }}>
                            <strong>🔗 Linked to:</strong> {job.linkedBlogs.join(', ')}
                          </p>
                        )}
                        
                        {/* Posting Times & Author */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '0.6rem 0', fontSize: '13px' }}>
                          <div>
                            <strong>Posting at:</strong> <span style={{ backgroundColor: '#e3f2fd', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{job.times.join(', ')}</span>
                          </div>
                          <div>
                            <strong>Author:</strong> <span style={{ backgroundColor: '#f3e5f5', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>Scheduled Bot</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ margin: '1rem 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>Progress:</p>
                            <span style={{ fontSize: '12px', color: '#0070f3', fontWeight: 'bold' }}>{job.postedCount} / {job.totalKeywords}</span>
                          </div>
                          <div style={{
                            width: '100%',
                            height: '24px',
                            backgroundColor: '#e0e0e0',
                            borderRadius: '12px',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              backgroundColor: job.postedCount === job.totalKeywords ? '#28a745' : '#0070f3',
                              width: `${job.totalKeywords > 0 ? (job.postedCount / job.totalKeywords) * 100 : 0}%`,
                              transition: 'width 0.3s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 'bold',
                            }}>
                              {job.totalKeywords > 0 && `${Math.round((job.postedCount / job.totalKeywords) * 100)}%`}
                            </div>
                          </div>
                        </div>

                        {/* Created at */}
                        <p style={{ margin: '0.8rem 0 1rem 0', fontSize: '12px', color: '#999' }}>
                          Created: {new Date(job.createdAt).toLocaleString()}
                        </p>

                        {/* Buttons */}
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                          <button
                            type="button"
                            onClick={() => fetchJobLogs(job.jobId)}
                            style={{
                              padding: '0.5rem 0.8rem',
                              backgroundColor: '#0070f3',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '12px',
                              flex: 1,
                              transition: 'background-color 0.2s',
                            }}
                          >
                            📊 View Logs
                          </button>
                          <button
                            type="button"
                            onClick={() => stopScheduledJob(job.jobId)}
                            style={{
                              padding: '0.5rem 0.8rem',
                              backgroundColor: '#dc3545',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '12px',
                              flex: 1,
                              transition: 'background-color 0.2s',
                            }}
                          >
                            ⏹ Stop
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#999', margin: 0, textAlign: 'center', padding: '2rem 0' }}>No active scheduled jobs. Create one above!</p>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Job Logs Detailed View */}
        {showJobLogs && jobLogs && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}>
            <div style={{
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              padding: '2rem',
              border: '2px solid #0070f3',
              borderRadius: '12px',
              backgroundColor: '#fff',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: '#0070f3' }}>📊 Job Details & Logs</h3>
                <button
                  type="button"
                  onClick={() => setShowJobLogs(false)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: '#999',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Summary */}
              <div style={{
                padding: '1rem',
                backgroundColor: '#f0f7ff',
                border: '1px solid #0070f3',
                borderRadius: '8px',
                marginBottom: '1.5rem',
              }}>
                <p style={{ margin: '0.4rem 0', fontSize: '14px' }}>
                  <strong>Status:</strong> <span style={{ color: jobLogs.status === 'completed' ? '#28a745' : '#0070f3', fontWeight: 'bold', fontSize: '15px' }}>{jobLogs.status === 'completed' ? '✓ Completed' : '⏱ Running'}</span>
                </p>
                <p style={{ margin: '0.4rem 0', fontSize: '14px' }}><strong>Total Keywords:</strong> {jobLogs.summary.totalKeywords}</p>
                <p style={{ margin: '0.4rem 0', fontSize: '14px' }}><strong>Successfully Posted:</strong> <span style={{ color: '#28a745', fontWeight: 'bold' }}>{jobLogs.summary.successfulPosts}</span></p>
                {jobLogs.summary.failedPosts > 0 && (
                  <p style={{ margin: '0.4rem 0', fontSize: '14px' }}><strong>Failed Posts:</strong> <span style={{ color: '#dc3545', fontWeight: 'bold' }}>{jobLogs.summary.failedPosts}</span></p>
                )}
                
                {/* Duplicate Information */}
                {jobLogs.summary.duplicateInfo && (
                  <>
                    <p style={{ margin: '0.8rem 0 0.4rem 0', fontSize: '14px' }}><strong>🔍 Duplicate Analysis:</strong></p>
                    <p style={{ margin: '0.3rem 0', fontSize: '13px', paddingLeft: '1rem' }}>
                      <strong>Exact Matches (Phrase):</strong> {jobLogs.summary.duplicateInfo.exactMatches || 0}
                    </p>
                    <p style={{ margin: '0.3rem 0', fontSize: '13px', paddingLeft: '1rem' }}>
                      <strong>Similar (Broad Match):</strong> {jobLogs.summary.duplicateInfo.similarMatches || 0}
                    </p>
                  </>
                )}
                
                {/* Linking Information */}
                {jobLogs.summary.linkingInfo && jobLogs.summary.linkingInfo.totalLinked > 0 && (
                  <>
                    <p style={{ margin: '0.8rem 0 0.4rem 0', fontSize: '14px' }}><strong>🔗 Internal Linking:</strong></p>
                    <p style={{ margin: '0.3rem 0', fontSize: '13px', paddingLeft: '1rem' }}>
                      <strong>Blogs Linked:</strong> {jobLogs.summary.linkingInfo.totalLinked}
                    </p>
                    <p style={{ margin: '0.3rem 0', fontSize: '13px', paddingLeft: '1rem' }}>
                      <strong>Link Density:</strong> {jobLogs.summary.linkingInfo.avgLinkDensity || 'N/A'}
                    </p>
                    {jobLogs.summary.linkingInfo.linkedBlogsList && jobLogs.summary.linkingInfo.linkedBlogsList.length > 0 && (
                      <p style={{ margin: '0.3rem 0', fontSize: '12px', paddingLeft: '1rem', color: '#0070f3' }}>
                        Linked to: {jobLogs.summary.linkingInfo.linkedBlogsList.join(', ')}
                      </p>
                    )}
                  </>
                )}
                
                <p style={{ margin: '0.8rem 0 0.4rem 0', fontSize: '13px', fontWeight: 'bold' }}>Completion: {jobLogs.summary.percentageComplete}%</p>
                <div style={{
                  width: '100%',
                  height: '24px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    backgroundColor: jobLogs.summary.allKeywordsPosted ? '#28a745' : '#0070f3',
                    width: `${jobLogs.summary.percentageComplete}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <p style={{ margin: '0.8rem 0 0 0', fontSize: '12px', color: '#666' }}>
                  <strong>Keywords Covered:</strong> {jobLogs.summary.keywordsCovered.length > 0 ? jobLogs.summary.keywordsCovered.join(', ') : 'None yet'}
                </p>
              </div>

              {/* Posted Blogs List */}
              <h4 style={{ margin: '0 0 0.8rem 0', color: '#333' }}>📝 Posted Blogs ({jobLogs.postedBlogs?.length || 0})</h4>
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9',
              }}>
                {jobLogs.postedBlogs && jobLogs.postedBlogs.length > 0 ? (
                  <ul style={{ padding: '1rem', margin: 0, listStyle: 'none' }}>
                    {jobLogs.postedBlogs.map((blog, idx) => (
                      <li key={idx} style={{
                        marginBottom: '0.8rem',
                        paddingBottom: '0.8rem',
                        borderBottom: idx < jobLogs.postedBlogs.length - 1 ? '1px solid #eee' : 'none',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 0.3rem 0', fontWeight: 'bold', fontSize: '13px' }}>
                              {blog.keyword}
                            </p>
                            <p style={{ margin: '0.2rem 0', fontSize: '11px', color: '#999' }}>
                              {new Date(blog.timestamp).toLocaleString()}
                            </p>
                            {/* Link Information */}
                            {blog.linkedBlogs && blog.linkedBlogs.length > 0 && (
                              <p style={{ margin: '0.3rem 0 0 0', fontSize: '11px', color: '#0070f3', fontWeight: 'bold' }}>
                                🔗 Linked: {blog.linkedBlogs.join(', ')}
                              </p>
                            )}
                            {/* Duplicate Info */}
                            {blog.duplicateInfo && (
                              <p style={{ margin: '0.3rem 0 0 0', fontSize: '11px', color: '#ff9800' }}>
                                {blog.duplicateInfo.exactMatch ? '⚠️ Exact Match' : blog.duplicateInfo.similarMatch ? '⚠️ Similar Match' : '✓ Unique'}
                              </p>
                            )}
                          </div>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            backgroundColor: blog.status === 'success' ? '#d4edda' : '#f8d7da',
                            color: blog.status === 'success' ? '#155724' : '#721c24',
                            whiteSpace: 'nowrap',
                          }}>
                            {blog.status === 'success' ? '✓' : '✕'}
                          </span>
                        </div>
                        {blog.title && <p style={{ margin: '0.3rem 0 0 0', fontSize: '12px', color: '#666' }}><strong>Title:</strong> {blog.title}</p>}
                        {blog.error && <p style={{ margin: '0.3rem 0 0 0', fontSize: '12px', color: '#dc3545' }}><strong>Error:</strong> {blog.error}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ padding: '1.5rem', margin: 0, color: '#999', textAlign: 'center' }}>No blogs posted yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
        
        
        {content && Array.isArray(content) && content.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h2>✅ Generated Blogs ({content.length})</h2>
            {content.map((blog, index) => (
              <div key={index} style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #ddd' }}>
                <h3>{blog.title}</h3>
                <p><strong>Meta Description:</strong> {blog.metaDescription}</p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowBlogs(!showBlogs)}
          style={{
            marginTop: '1rem',
            padding: '0.7rem 1.2rem',
            backgroundColor: '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            width: '100%',
            fontWeight: 'bold',
            fontSize: '14px',
            transition: 'background-color 0.2s',
          }}
        >
          {showBlogs ? '▼ Hide Published Blogs' : '▶ View Published Blogs'} {savedBlogs.length > 0 && `(${savedBlogs.length})`}
        </button>

        {showBlogs && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>📚 Saved Blogs</h3>
            {savedBlogs.length > 0 ? (
              <div
                style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid #ddd',
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: '#f9f9f9',
                }}
              >
                {savedBlogs.map((blog, index) => (
                  <div key={index} style={{ marginBottom: '0.8rem', paddingBottom: '0.8rem', borderBottom: index < savedBlogs.length - 1 ? '1px solid #eee' : 'none' }}>
                    <a
                      href={`https://odysshoes.com/blogs/news/${generateSlug(blog.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}
                    >
                      {blog.title}
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#999', textAlign: 'center', margin: '2rem 0' }}>No blogs saved yet.</p>
            )}
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}