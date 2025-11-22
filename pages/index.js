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
          <h1>{content.title}</h1>
          <p>
            <strong>Meta Description:</strong> {content.metaDescription}
          </p>
          <h2>{content.h1}</h2>
          {content.intro && <p>{content.intro}</p>}
          <div>
  {content.mainContent.map((section, index) => (
    <div key={index} style={{ marginBottom: "1.5rem" }}>
      <h2>{section.heading}</h2>
      <ul style={{ paddingLeft: "1.5rem" }}>
        {section.content.map((item, idx) => {
          if (item.type === "paragraph") {
            return <p key={idx} style={{ paddingLeft: "0" }}>{item.text}</p>; // No list styles for paragraphs
          } else if (item.type === "bullet") {
            return <li key={idx} style={{ listStyleType: "disc" }}>{item.text}</li>;
          } else if (item.type === "numbered") {
            return <li key={idx} style={{ listStyleType: "decimal" }}>{item.text}</li>;
          }
          return null; // Fallback for unmatched item types
        })}
      </ul>
    </div>
  ))}
</div>
          <div>
  <h2>Frequently Asked Questions:</h2>
  {content.faqs.map((faq, idx) => (
    <div key={idx} style={{ marginBottom: "1rem" }}>
      <h3>{faq.question}</h3>
      <p>{faq.answer}</p>
    </div>
  ))}
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