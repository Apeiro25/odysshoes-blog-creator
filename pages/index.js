import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState(''); // State for the current prompt
  const [blogs, setBlogs] = useState([]);  // State to handle multiple blogs

  // Function to handle blog generation
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error! Status: ${response.status}`);
      }

      const data = await response.json();

      // Update the blogs list
      setBlogs((prevBlogs) => [
        ...prevBlogs,
        { title: prompt, content: data.blog }, // Each blog has a title and content
      ]);

      setPrompt(''); // Clear the input field
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
            rows="4"
            cols="50"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button type="submit" className={styles.buttonClass}>
            Generate Blog
          </button>
        </form>

        <div className={styles.blogList}>
          {blogs.map((blog, index) => (
            <div key={index} className={styles.blogItem}>
              <h2>{blog.title}</h2>
              <p>{blog.content}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className={styles.footer}>
        Powered by OpenAI
      </footer>
    </div>
  );
}