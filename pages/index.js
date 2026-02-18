import Head from 'next/head';
import styles from '../styles/Home.module.css';
import React, { useState, useEffect } from 'react';

export default function Home() {
  const [keywords, setKeywords] = useState('');
  const [author, setAuthor] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [mode, setMode] = useState('generate'); // 'generate' or 'scrape'
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedBlogs, setSavedBlogs] = useState([]);
  const [showBlogs, setShowBlogs] = useState(false);

  useEffect(() => {
    // Load saved blogs from local storage
    const blogs = JSON.parse(localStorage.getItem('savedBlogs')) || [];
    setSavedBlogs(blogs);
  }, []);

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
            body: JSON.stringify({ keyword, author }),
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
            author 
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
        <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Blog Creator</h1>
        
        {/* Mode Selection */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
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
        </div>

        <form onSubmit={generateBlog}>
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
            placeholder={mode === 'generate' ? "Keywords (comma-separated)" : "Blog Keywords (optional - auto-detected if left blank)"}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            style={inputStyle}
          />

          {/* Author Name Input */}
          <input
            type="text"
            placeholder="Author Name"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            style={inputStyle}
          />

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
            {loading ? 'Processing...' : mode === 'generate' ? 'Generate & Publish Blog' : 'Scrape, Generate & Publish'}
          </button>
        </form>
        {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
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