import Head from 'next/head';
import styles from '../styles/Home.module.css';
import React, { useState } from "react";

export default function Home() {
  const [keywords, setKeywords] = useState("");
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateBlog = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setContent(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keywords }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate blog. Please try again.");
      }

      const data = await response.json();
      setContent(data.blog); // The structured JSON blog data
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Blog Creator</h1>
      <form onSubmit={generateBlog} style={{ marginBottom: "1.5rem" }}>
        <input
          type="text"
          placeholder="Enter keywords e.g. SEO tips"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          style={{
            padding: "0.5rem",
            width: "300px",
            marginRight: "1rem",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate Blog"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {content && (
        <div>
          <h2>{content.title}</h2>
          <p>
            <strong>Meta Description:</strong> {content.metaDescription}
          </p>
          <h3>{content.h1}</h3>
          <div>
  {content.mainContent.map((section, index) => (
    <div key={index}>
      <h2>{section.heading}</h2>
      {section.content.map((item, idx) => (
        <p key={idx}>{item}</p>
      ))}
    </div>
  ))}
</div>
          <div>
            <h3>Frequenlty Asked Questions:</h3>
            <ul>
              {content.faqs.map((faq, idx) => (
                <li key={idx}>
                  <strong>Q:</strong> {faq.question} <br />
                  <strong>A:</strong> {faq.answer}
                </li>
              ))}
            </ul>
          </div>
          <div>
  <h2>{content.outro.heading}</h2>
  <p>{content.outro.paragraph}</p>
</div>
        </div>
      )}
    </div>
  );
}