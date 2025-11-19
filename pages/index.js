import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [blog, setBlog] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      setBlog(data.blog); // Update blog text
    } catch (error) {
      console.error('Error generating blog:', error);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Blog Generator</title>
        <meta name="description" content="Generate blogs using OpenAI" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.titleClass}>Blog Generator</h1>
        <form onSubmit={handleSubmit}>
          <textarea
            className={styles.textareaClass}
            placeholder="Enter your prompt here..."
            rows="10"
            cols="50"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button type="submit" className={styles.buttonClass}>Generate Blog</button>
        </form>

        {blog && (
          <div className={styles.blogOutput}>
            <h2>Generated Blog</h2>
            <p>{blog}</p>
          </div>
        )}

      </main>

      <footer className={styles.footer}>
        Powered by OpenAI
      </footer>
    </div>
  );
}