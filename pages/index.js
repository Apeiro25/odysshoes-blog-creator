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
  const [scheduleTimes, setScheduleTimes] = useState('08:00,12:00,18:00');
  const [activeJobs, setActiveJobs] = useState([]);
  const [showActiveJobs, setShowActiveJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [jobLogs, setJobLogs] = useState(null);
  const [showJobLogs, setShowJobLogs] = useState(false);

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
    maxWidth: '500px',
    margin: '0 auto',
    padding: '2rem',
    border: '1px solid #ddd',
    borderRadius: '10px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
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

    if (!keywords || !keywords.trim()) {
      setError('Keywords are required for scheduling.');
      setLoading(false);
      return;
    }

    try {
      const keywordList = keywords.split(',').map((kw) => kw.trim()).filter(kw => kw);
      const timeList = scheduleTimes.split(',').map((t) => t.trim()).filter(t => t);

      const response = await fetch('/api/schedule-posting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywordList,
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
      alert(`✓ Scheduled! Job ID: ${data.jobId}\n\nBlogs will post at: ${timeList.join(', ')}`);
      setKeywords('');
      setScheduleTimes('08:00,12:00,18:00');
      
      // Refresh active jobs list
      await fetchActiveJobs();
    } catch (err) {
      setError(err.message);
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

      alert('✓ Scheduled posting job stopped successfully!');
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
    <div style={centeredContainer}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ textAlign: 'center', flex: 1, margin: 0 }}>Blog Creator</h1>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '12px',
            }}
          >
            ⚙️ Settings
          </button>
        </div>

        {showSettings && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            border: '2px solid #0070f3',
            borderRadius: '8px',
            backgroundColor: '#f0f7ff',
          }}>
            <h3>Shopify Configuration</h3>
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
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%',
                fontWeight: 'bold',
              }}
            >
              Save Credentials
            </button>
            {shopifyToken && shopifyShop && shopifyBlogId && (
              <p style={{ color: 'green', marginTop: '0.5rem', fontSize: '12px' }}>✓ Credentials configured</p>
            )}
          </div>
        )}
        
        {/* Mode Selection */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setMode('generate')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: mode === 'generate' ? '#0070f3' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ✨ Generate Blog
          </button>
          <button
            type="button"
            onClick={() => setMode('scrape')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: mode === 'scrape' ? '#0070f3' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            🔍 Scrape & Repurpose
          </button>
          <button
            type="button"
            onClick={() => setMode('schedule')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: mode === 'schedule' ? '#0070f3' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ⏰ Schedule Posting
          </button>
        </div>

        <form onSubmit={mode === 'schedule' ? scheduleBlogs : generateBlog}>
          {/* Competitor URLs - Only shown in scrape mode */}
          {mode === 'scrape' && (
            <textarea
              placeholder="Competitor Blog URLs (comma-separated, e.g., https://example1.com/blog, https://example2.com/blog)"
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              style={{...inputStyle, minHeight: '80px', fontFamily: 'monospace'}}
            />
          )}

          {/* Keywords Input */}
          <input
            type="text"
            placeholder={mode === 'generate' ? "Keywords (comma-separated)" : mode === 'scrape' ? "Blog Keywords (optional - auto-detected if left blank)" : "Keywords for scheduling (comma-separated)"}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            style={inputStyle}
          />

          {/* Schedule Times - Only shown in schedule mode */}
          {mode === 'schedule' && (
            <input
              type="text"
              placeholder="Posting times in HH:MM format (comma-separated, e.g., 08:00,12:00,18:00)"
              value={scheduleTimes}
              onChange={(e) => setScheduleTimes(e.target.value)}
              style={{...inputStyle, fontFamily: 'monospace'}}
            />
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
              padding: '0.5rem 1rem',
              backgroundColor: '#0070f3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '100%',
              fontWeight: 'bold',
            }}
            disabled={loading}
          >
            {loading ? 'Processing...' : mode === 'generate' ? 'Generate & Publish Blog' : mode === 'scrape' ? 'Scrape, Generate & Publish' : 'Start Scheduled Posting'}
          </button>
        </form>
        {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
        
        {/* Active Scheduled Jobs Section */}
        {mode === 'schedule' && (
          <div style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={() => {
                setShowActiveJobs(!showActiveJobs);
                if (!showActiveJobs) fetchActiveJobs();
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ff9800',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%',
                fontWeight: 'bold',
              }}
            >
              {showActiveJobs ? '▼ Hide Active Jobs' : '▶ View Active Jobs'} {activeJobs.length > 0 && `(${activeJobs.length})`}
            </button>

            {showActiveJobs && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                border: '2px solid #ff9800',
                borderRadius: '8px',
                backgroundColor: '#fff8f0',
              }}>
                {activeJobs.length > 0 ? (
                  <div>
                    {activeJobs.map((job) => (
                      <div key={job.jobId} style={{
                        marginBottom: '1rem',
                        padding: '1rem',
                        backgroundColor: '#fff',
                        border: '1px solid #ff9800',
                        borderRadius: '4px',
                      }}>
                        <p><strong>Job ID:</strong> <code style={{ fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '2px 4px' }}>{job.jobId}</code></p>
                        <p><strong>Keywords:</strong> {job.keywords.join(', ')}</p>
                        <p><strong>Posting Times:</strong> {job.times.join(', ')}</p>
                        <p><strong>Created:</strong> {new Date(job.createdAt).toLocaleString()}</p>
                        
                        {/* Progress Bar */}
                        <div style={{ marginBottom: '0.5rem' }}>
                          <p><strong>Progress:</strong> {job.postedCount} / {job.totalKeywords} blogs posted</p>
                          <div style={{
                            width: '100%',
                            height: '20px',
                            backgroundColor: '#e0e0e0',
                            borderRadius: '10px',
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
                              fontSize: '12px',
                              fontWeight: 'bold',
                            }}>
                            </div>
                          </div>
                        </div>

                        {/* Buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => fetchJobLogs(job.jobId)}
                            style={{
                              padding: '0.4rem 0.8rem',
                              backgroundColor: '#0070f3',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '12px',
                              flex: 1,
                            }}
                          >
                            📊 View Logs
                          </button>
                          <button
                            type="button"
                            onClick={() => stopScheduledJob(job.jobId)}
                            style={{
                              padding: '0.4rem 0.8rem',
                              backgroundColor: '#dc3545',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '12px',
                              flex: 1,
                            }}
                          >
                            ✕ Stop Job
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#666' }}>No active scheduled jobs.</p>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Job Logs Detailed View */}
        {showJobLogs && jobLogs && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            border: '2px solid #0070f3',
            borderRadius: '8px',
            backgroundColor: '#f0f7ff',
          }}>
            <button
              type="button"
              onClick={() => setShowJobLogs(false)}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: '#666',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px',
                marginBottom: '1rem',
              }}
            >
              ✕ Close Logs
            </button>

            <h3 style={{ marginTop: 0 }}>📊 Job Logs - {jobLogs.jobId}</h3>
            
            {/* Summary */}
            <div style={{
              padding: '1rem',
              backgroundColor: '#fff',
              border: '1px solid #0070f3',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}>
              <p><strong>Status:</strong> <span style={{ color: jobLogs.status === 'completed' ? '#28a745' : '#0070f3', fontWeight: 'bold' }}>{jobLogs.status === 'completed' ? '✓ Completed' : '⏱ Running'}</span></p>
              <p><strong>Total Keywords:</strong> {jobLogs.summary.totalKeywords}</p>
              <p><strong>Successfully Posted:</strong> {jobLogs.summary.successfulPosts}</p>
              <p><strong>Failed Posts:</strong> {jobLogs.summary.failedPosts > 0 ? <span style={{ color: '#dc3545' }}>{jobLogs.summary.failedPosts}</span> : 0}</p>
              <p><strong>Completion:</strong> {jobLogs.summary.percentageComplete}%</p>
              <div style={{
                width: '100%',
                height: '20px',
                backgroundColor: '#e0e0e0',
                borderRadius: '10px',
                overflow: 'hidden',
                marginTop: '0.5rem',
              }}>
                <div style={{
                  height: '100%',
                  backgroundColor: jobLogs.summary.allKeywordsPosted ? '#28a745' : '#0070f3',
                  width: `${jobLogs.summary.percentageComplete}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <p style={{ marginTop: '0.5rem', fontSize: '12px', color: '#666' }}>
                Keywords Covered: {jobLogs.summary.keywordsCovered.join(', ') || 'None yet'}
              </p>
            </div>

            {/* Posted Blogs List */}
            <h4>Posted Blogs:</h4>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#fff',
            }}>
              {jobLogs.postedBlogs && jobLogs.postedBlogs.length > 0 ? (
                <ul style={{ padding: '1rem', margin: 0 }}>
                  {jobLogs.postedBlogs.map((blog, idx) => (
                    <li key={idx} style={{
                      marginBottom: '0.8rem',
                      paddingBottom: '0.8rem',
                      borderBottom: idx < jobLogs.postedBlogs.length - 1 ? '1px solid #eee' : 'none',
                    }}>
                      <p style={{ margin: '0 0 0.3rem 0' }}>
                        <strong>{blog.keyword}</strong> 
                        <span style={{
                          marginLeft: '0.5rem',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: blog.status === 'success' ? '#d4edda' : '#f8d7da',
                          color: blog.status === 'success' ? '#155724' : '#721c24',
                        }}>
                          {blog.status === 'success' ? '✓ Success' : '✕ Failed'}
                        </span>
                      </p>
                      <p style={{ margin: '0.2rem 0', fontSize: '12px', color: '#666' }}>
                        {new Date(blog.timestamp).toLocaleString()}
                      </p>
                      {blog.title && <p style={{ margin: '0.2rem 0', fontSize: '12px' }}><strong>Title:</strong> {blog.title}</p>}
                      {blog.error && <p style={{ margin: '0.2rem 0', fontSize: '12px', color: '#dc3545' }}><strong>Error:</strong> {blog.error}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ padding: '1rem', margin: 0, color: '#666' }}>No blogs posted yet.</p>
              )}
            </div>
          </div>
        )}
        
        {content && Array.isArray(content) && content.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h2>Generated Blogs ({content.length}):</h2>
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
            padding: '0.5rem 1rem',
            backgroundColor: '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            width: '100%',
            fontWeight: 'bold',
          }}
        >
          {showBlogs ? 'Hide Published Blogs' : 'View Published Blogs'}
        </button>

        {showBlogs && (
          <div style={{ marginTop: '2rem' }}>
            <h3>Saved Blogs</h3>
            {savedBlogs.length > 0 ? (
              <div
                style={{
                  maxHeight: '150px', // Limit height to 5 titles
                  overflowY: 'scroll', // Enable scrolling for more titles
                  border: '1px solid #ddd',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  backgroundColor: '#f9f9f9',
                }}
              >
                {savedBlogs.map((blog, index) => (
                  <div key={index} style={{ marginBottom: '0.5rem' }}>
                    <h4
                      style={{
                        fontSize: '14px', // Set the font size to 14px
                        margin: '0', // Remove extra spacing
                        lineHeight: '1.5', // Add readable spacing
                      }}
                    >
                      <a
                        href={`https://odysshoes.com/blogs/news/${generateSlug(blog.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#0070f3', textDecoration: 'none' }}
                      >
                        {blog.title}
                      </a>
                    </h4>
                  </div>
                ))}
              </div>
) : (
  <p>No blogs saved yet.</p>
)}
          </div>
        )}
      </div>
    </div>
  );
}