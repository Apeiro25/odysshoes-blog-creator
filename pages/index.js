import Head from 'next/head';
import styles from '../styles/Home.module.css';
import React, { useState, useEffect } from 'react';

export default function Home() {
  const [keywords, setKeywords] = useState('');
  const [shopifyToken, setShopifyToken] = useState('');
  const [shopifyShop, setShopifyShop] = useState('');
  const [blogId, setBlogId] = useState('');
  const [author, setAuthor] = useState('');
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

    if (!shopifyToken || !shopifyShop || !blogId || !author) {
      setError('All fields are required.');
      setLoading(false);
      return;
    }

    const keywordList = keywords.split(',').map((kw) => kw.trim()); // Split and trim keywords
    const generatedBlogs = []; // Store generated blogs

    try {
      for (const keyword of keywordList) {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ keywords: keyword, shopifyToken, shopifyShop, blogId, author }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate blog for keyword: ${keyword}`);
        }

        const data = await response.json();
        generatedBlogs.push(data.blog); // Add generated blog to the list
      }

      setContent(generatedBlogs); // Display all generated blogs
      setSavedBlogs((prev) => [...prev, ...generatedBlogs]); // Save them in local state
      localStorage.setItem('savedBlogs', JSON.stringify([...savedBlogs, ...generatedBlogs])); // Update local storage
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
        <form onSubmit={generateBlog}>
          {/* Shopify API Key Input */}
          <input
            type="text"
            placeholder="Shopify API Key"
            value={shopifyToken}
            onChange={(e) => setShopifyToken(e.target.value)}
            style={inputStyle}
          />

          {/* Shopify Store Input */}
          <input
            type="text"
            placeholder="Shopify Store"
            value={shopifyShop}
            onChange={(e) => setShopifyShop(e.target.value)}
            style={inputStyle}
          />

          {/* Blog ID Input */}
          <input
            type="text"
            placeholder="Blog ID"
            value={blogId}
            onChange={(e) => setBlogId(e.target.value)}
            style={inputStyle}
          />

          {/* Keywords Input */}
          <input
            type="text"
            placeholder="Keywords"
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
            {loading ? 'Generating & Publishing...' : 'Generate & Publish Blog'}
          </button>
        </form>
        {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
        {content && (
          <div style={{ marginTop: '2rem' }}>
            <h2>Generated Blog:</h2>
            <h3>{content.title}</h3>
            <p>{content.body_html}</p>
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