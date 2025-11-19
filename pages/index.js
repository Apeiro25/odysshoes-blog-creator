import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState(''); // Input prompt for user
  const [blogs, setBlogs] = useState([]);  // List to store multiple blogs

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default page reload on form submission
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

      // Add the new blog to the blogs array
      setBlogs((prevBlogs) => [
        ...prevBlogs,
        {
          title: prompt, // Use the prompt as the title
          metaDescription: 'Meta description placeholder', // Placeholder
          h1: 'H1 Title Placeholder',
          intro: 'Introduction placeholder text',
          subHeadings: {
            h2: 'H2: Placeholder sub-heading 1',
            h3: 'H3: Placeholder sub-heading 2',
            h4: 'H4: Placeholder sub-heading 3',
            h5: 'H5: Placeholder sub-heading 4',
            h6: 'H6: Placeholder sub-heading 5',
          },
        },
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
        <h1 className={styles.title}>Generate Blogs</h1>

        <form onSubmit={handleSubmit}>
          <textarea
            className={styles.textareaClass}
            placeholder="Enter a blog prompt..."
            rows="5"
            cols="50"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button type="submit" className={styles.buttonClass}>Generate</button>
        </form>

        <div className={styles.blogList}>
          {blogs.map((blog, index) => (
            <div key={index} className={styles.blogItem}>
              <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>1: Title</h2>
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>{blog.title}</p>

              <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>2: Meta Description</h2>
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>{blog.metaDescription}</p>

              <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>3: H1</h2>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>{blog.h1}</p>

              <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>4: Introduction</h2>
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>{blog.intro}</p>

              <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>5: Sub-headings</h2>
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>{blog.subHeadings.h2}</p>
              <p style={{ fontSize: '13px', marginBottom: '8px' }}>{blog.subHeadings.h3}</p>
              <p style={{ fontSize: '12px', marginBottom: '8px' }}>{blog.subHeadings.h4}</p>
              <p style={{ fontSize: '11px', marginBottom: '8px' }}>{blog.subHeadings.h5}</p>
              <p style={{ fontSize: '10px', marginBottom: '8px' }}>{blog.subHeadings.h6}</p>
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