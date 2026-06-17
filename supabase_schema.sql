-- Supabase Schema for RSS Feed Summarizer
-- Copy and run this script in your Supabase project's SQL Editor:

-- 1. Create the feeds table
CREATE TABLE IF NOT EXISTS feeds (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create the articles table
CREATE TABLE IF NOT EXISTS articles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  date TEXT,
  author TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  summary TEXT NOT NULL,
  feed_name TEXT,
  tag TEXT DEFAULT 'Unknown',
  image_url TEXT,
  feed_id BIGINT REFERENCES feeds(id) ON DELETE CASCADE
);

-- MIGRATION NOTE FOR EXISTING PROJECTS:
-- If you already created your database tables, run the following statements in your SQL Editor:
-- ALTER TABLE articles ADD COLUMN IF NOT EXISTS feed_id BIGINT REFERENCES feeds(id) ON DELETE CASCADE;
-- ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url TEXT;


-- 3. Disable Row Level Security (RLS) for simple backend access.
-- If you want to enable RLS, you must define appropriate access policies.
ALTER TABLE feeds DISABLE ROW LEVEL SECURITY;
ALTER TABLE articles DISABLE ROW LEVEL SECURITY;

-- 4. Insert initial sample feeds if you'd like
INSERT INTO feeds (name, url) 
VALUES 
  ('Hacker News', 'https://news.ycombinator.com/rss'),
  ('BBC News', 'https://feeds.bbci.co.uk/news/rss.xml')
ON CONFLICT (url) DO NOTHING;
