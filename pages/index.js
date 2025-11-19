import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Blog Generator</title>
        <meta name="description" content="Generate blogs using OpenAI" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.titleClass}>Blog Generator</h1>
        <p className={styles.descriptionClass}>Enter a prompt to generate your blog</p>
        <form>
          <textarea className={styles.textareaClass} placeholder="Enter your prompt here..." rows="10" cols="50" />
          <button type="submit" className={styles.buttonClass}>Generate Blog</button>
        </form>
      </main>

      <footer className={styles.footer}>
        Powered by OpenAI
      </footer>
    </div>
  );
}