import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [blog, setBlog] = useState('');

  // Function to handle blog generation
  const handleSubmit = async (e) => {
  e.preventDefault(); // Prevent default form submission
  try {
    const response = await fetch('/api/generate', { // API call to the backend
      method: 'POST', // Ensure this is a POST request
      headers: {
        'Content-Type': 'application/json', // Indicate request content type
      },
      body: JSON.stringify({ prompt }), // Send the prompt as JSON
    });

    // Handle errors
    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }

    const data = await response.json(); // Retrieve the response from the backend
    setBlog(data.blog); // Set generated blog content
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
            value={prompt} // Link the textarea input to state
            onChange={(e) => setPrompt(e.target.value)} // Update state on change
          />
          <button type="submit" className={styles.buttonClass}>Generate Blog</button>
        </form>

        {/* Conditional rendering to display the generated blog */}
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