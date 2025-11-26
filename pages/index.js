import Head from 'next/head';
import styles from '../styles/Home.module.css';
import React, { useState } from 'react';

export default function Home() {
  const [keywords, setKeywords] = useState('');
  const [shopifyToken, setShopifyToken] = useState('');
  const [shopifyShop, setShopifyShop] = useState('');
  const [blogId, setBlogId] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keywords, shopifyToken, shopifyShop, blogId, author }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate or publish the blog.');
      }

      const data = await response.json();
      setContent(data.blog); // Display generated data
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
            <h2>Blog Generated Successfully!</h2>
          </div>
        )}
      </div>
    </div>
  );
}