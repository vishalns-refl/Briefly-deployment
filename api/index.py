from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import requests
import feedparser
import json
import os
import time
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

app = FastAPI(title="RSS Feed Summarizer", version="1.0.0")

# CORS Configuration - allow localhost, Vercel deployments, and custom domain if set
allowed_origins = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]
frontend_url = os.environ.get("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    # Allow any localhost/127.0.0.1 port and all Vercel previews/deployments
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print("WARNING: SUPABASE_URL and SUPABASE_KEY are not set. Database operations will fail.")

# Global variables
max_text_length = 7000

# Default settings
default = {
    'url': os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1"),
    'api_key': os.environ.get("OPENAI_API_KEY", ""),
    'model': os.environ.get("FEEDSUMMARIZER_MODEL", "gpt-3.5-turbo"),
    'system': os.environ.get("FEEDSUMMARIZER_SYSTEM", "You are an expert summarizer."),
    'instruction': os.environ.get("FEEDSUMMARIZER_INSTRUCTION", "Summarize this article into a short, punchy tech fact (max 2 sentences) to put in a newsletter, prioritizing the most important information first and then adding supporting details (inverted pyramid style). Categorize it into one of the following categories: AI, New in Tech, Business, Games/Entertainment. Return the response in the following JSON format only and do NOT include any markdown or escape characters inside it :{\"summary\": \"Your summary here\", \"tag\": \"Category\"}"),
    'maximum': int(os.environ.get("FEEDSUMMARIZER_MAX_ARTICLES", "10")),  # Lowered default max articles per run for serverless efficiency
    'dyk_prompt': os.environ.get("FEEDSUMMARIZER_DYK_INSTRUCTION", "Turn this article into one fun, factual, and that feels like a surprising fact or hook for a newsletter. It should be exciting and attention-grabbing, but it does not have to start with 'Did you know'."),
    'time_lapse': int(os.environ.get("FEEDSUMMARIZER_TIME_LAPSE", "86400"))
}

# Pydantic models
class FeedRequest(BaseModel):
    url: str
    name: Optional[str] = ""

class FeedResponse(BaseModel):
    id: int
    name: str
    url: str

class ArticleResponse(BaseModel):
    id: int
    title: str
    url: str
    date: str
    author: str
    timestamp: str
    summary: str
    tag: str
    feed_name: Optional[str] = ""

class ArticleURLRequest(BaseModel):
    url: str

class NewsArticle:
    def __init__(self, entry, max_text_length):
        self.title = getattr(entry, 'title', 'Unknown')
        self.url = getattr(entry, 'link', 'NO LINK')
        self.date = getattr(entry, 'updated', getattr(entry, 'published', 'Unknown'))
        self.author = getattr(entry, 'author', 'Unknown')
        self.timestamp = datetime.now().isoformat()
        self.text = self.get_page_content(self.url, max_text_length)
        self.summary = ""
        self.feed_name = ""
        self.tag = ""
        
    def get_page_content(self, url, max_text_length):
        if url == "NO LINK":
            return "The feed entry doesn't seem to have any URL."
        
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
        except Exception as e:
            return f"The page {url} could not be loaded: {str(e)}"
        
        soup = BeautifulSoup(response.content, "html.parser")
        paragraphs = soup.find_all("p")
        
        if paragraphs:
            text = "\n".join(p.get_text() for p in paragraphs)
            words = text.split()
            if len(words) > max_text_length:
                text = " ".join(words[:max_text_length]) + "..."
            return f"Content of {url}:\n{text}"
        else:
            return f"The web page at {url} doesn't seem to have any readable content."
    
    def summarize(self, settings):
        if self.text and "doesn't seem to have any URL" not in self.text:
            self.summary, self.tag = generate_ai_response(self.text, settings)
        else:
            self.summary = "Could not summarize - no content available"
            self.tag = "Unknown"
        return self.summary
    
    def to_dict(self):
        return {
            'title': self.title,
            'url': self.url,
            'date': self.date,
            'author': self.author,
            'timestamp': self.timestamp,
            'summary': self.summary,
            'feed_name': getattr(self, 'feed_name', ''),
            'tag': self.tag
        }

def generate_ai_response(content, settings):
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings['api_key']}"
        }
        
        messages = [
            {"role": "system", "content": settings['system']},
            {"role": "user", "content": f"{content}\n\n{settings['instruction']}"}
        ]
        
        data = {
            'model': settings['model'],
            'messages': messages,
            'max_tokens': 600,
            'temperature': 0.7
        }
        
        response = requests.post(
            f"{settings['url']}/chat/completions",
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code == 200:
            response_text = response.json()['choices'][0]['message']['content'].strip()
            
            # Extract JSON from potential markdown response
            start = response_text.find("{")
            end = response_text.rfind("}")
            if start != -1 and end != -1:
                response_text = response_text[start:end+1]
            else:
                return f"Error parsing response text: {response_text}", "Unknown"
            
            response_text = response_text.replace("\n", "").replace("\t", "")
            
            try:
                response_json = json.loads(response_text)
                summary = response_json.get('summary', '').strip()
                tag = response_json.get('tag', 'Unknown').strip()
                return summary, tag
            except json.JSONDecodeError:
                return f"Error parsing JSON: {response_text}", "Unknown"
        else:
            return f"LLM Error: {response.status_code}", "Unknown"
            
    except Exception as e:
        return f"Exception occurred: {str(e)}", "Unknown"

def fetch_article_text(url: str, max_text_length: int = 7000) -> str:
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
    except Exception as e:
        return f"The page {url} could not be loaded: {str(e)}"

    soup = BeautifulSoup(response.content, "html.parser")
    paragraphs = soup.find_all("p")

    if paragraphs:
        text = "\n".join(p.get_text() for p in paragraphs)
        words = text.split()
        if len(words) > max_text_length:
            text = " ".join(words[:max_text_length]) + "..."
        return f"Content of {url}:\n{text}"
    else:
        return f"The web page at {url} doesn't seem to have any readable content."

def clear_old_articles():
    """Remove articles older than a month (30 days) from the database"""
    if not supabase:
        return
    try:
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        # Delete items where timestamp is less than (older than) 30 days ago
        supabase.table("articles").delete().lt("timestamp", thirty_days_ago).execute()
        print("Cleared old articles from the database.")
    except Exception as e:
        print(f"Error clearing old articles: {e}")

def process_feeds_background():
    """Process RSS feeds and save new articles to the database"""
    if not supabase:
        print("Supabase client is not initialized.")
        return
        
    print("Starting RSS feed processing...")
    try:
        feeds_response = supabase.table("feeds").select("*").execute()
        feeds = feeds_response.data
    except Exception as e:
        print(f"Error loading feeds from database: {e}")
        return
        
    if not feeds:
        print("No feeds found to process")
        return
    
    settings = default.copy()
    new_articles_count = 0
    
    for feed_info in feeds:
        try:
            print(f"Processing feed: {feed_info['name']}")
            feed = feedparser.parse(feed_info['url'])
            feed_title = getattr(feed.feed, 'title', feed_info['name'])
            
            entries = feed.entries[:settings['maximum']]
            now = time.time()
            
            for entry in entries:
                if hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                    then = time.mktime(entry.updated_parsed)
                elif hasattr(entry, 'published_parsed') and entry.published_parsed:
                    then = time.mktime(entry.published_parsed)
                else:
                    then = now
                
                # Check timeframe limit
                if (now - then) > settings['time_lapse']:
                    continue
                    
                url = getattr(entry, 'link', 'NO LINK')
                if url == 'NO LINK':
                    continue
                
                # Deduplication check: Check if this URL already exists in database
                try:
                    exists_response = supabase.table("articles").select("id").eq("url", url).execute()
                    if exists_response.data:
                        # Article already exists, skip
                        continue
                except Exception as e:
                    print(f"Database error checking duplicates: {e}")
                    continue
                
                print(f"Found new article: {getattr(entry, 'title', 'Unknown')}")
                article = NewsArticle(entry, max_text_length)
                article.feed_name = feed_title
                article.summarize(settings)
                
                # Save immediately to database
                try:
                    art_dict = article.to_dict()
                    supabase.table("articles").insert({
                        "title": art_dict['title'],
                        "url": art_dict['url'],
                        "date": art_dict['date'],
                        "author": art_dict['author'],
                        "summary": art_dict['summary'],
                        "feed_name": art_dict['feed_name'],
                        "tag": art_dict['tag'],
                        "feed_id": feed_info['id']
                    }).execute()
                    new_articles_count += 1
                except Exception as e:
                    print(f"Error saving article: {e}")
                    
        except Exception as e:
            print(f"Error processing feed {feed_info['name']}: {str(e)}")
            
    if new_articles_count > 0:
        clear_old_articles()
    print(f"Processed and saved {new_articles_count} new articles.")

def process_single_feed_by_id(feed_id: int):
    """Process a single RSS feed by its database ID and save new articles"""
    if not supabase:
        print("Supabase client is not initialized.")
        return 0
        
    try:
        feed_response = supabase.table("feeds").select("*").eq("id", feed_id).execute()
        if not feed_response.data:
            print(f"Feed with ID {feed_id} not found.")
            return 0
        feed_info = feed_response.data[0]
    except Exception as e:
        print(f"Error loading feed {feed_id} from database: {e}")
        return 0
        
    settings = default.copy()
    new_articles_count = 0
    
    try:
        print(f"Sync-processing feed: {feed_info['name']}")
        feed = feedparser.parse(feed_info['url'])
        feed_title = getattr(feed.feed, 'title', feed_info['name'])
        
        entries = feed.entries[:settings['maximum']]
        now = time.time()
        
        for entry in entries:
            if hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                then = time.mktime(entry.updated_parsed)
            elif hasattr(entry, 'published_parsed') and entry.published_parsed:
                then = time.mktime(entry.published_parsed)
            else:
                then = now
            
            # Check timeframe limit
            if (now - then) > settings['time_lapse']:
                continue
                
            url = getattr(entry, 'link', 'NO LINK')
            if url == 'NO LINK':
                continue
            
            # Deduplication check
            try:
                exists_response = supabase.table("articles").select("id").eq("url", url).execute()
                if exists_response.data:
                    continue
            except Exception as e:
                print(f"Database error checking duplicates: {e}")
                continue
            
            print(f"Found new article: {getattr(entry, 'title', 'Unknown')}")
            article = NewsArticle(entry, max_text_length)
            article.feed_name = feed_title
            article.summarize(settings)
            
            # Save immediately to database
            try:
                art_dict = article.to_dict()
                supabase.table("articles").insert({
                    "title": art_dict['title'],
                    "url": art_dict['url'],
                    "date": art_dict['date'],
                    "author": art_dict['author'],
                    "summary": art_dict['summary'],
                    "feed_name": art_dict['feed_name'],
                    "tag": art_dict['tag'],
                    "feed_id": feed_info['id']
                }).execute()
                new_articles_count += 1
            except Exception as e:
                print(f"Error saving article: {e}")
                
    except Exception as e:
        print(f"Error processing feed {feed_info['name']}: {str(e)}")
        
    if new_articles_count > 0:
        clear_old_articles()
        
    return new_articles_count

# FastAPI Endpoints

@app.get("/")
async def get_home():
    return HTMLResponse("<h3>RSS Feed Summarizer Backend API</h3><p>Running successfully on Vercel!</p>")

@app.get("/api/articles", response_model=List[ArticleResponse])
async def get_articles(limit: int = 100):
    """Get recent articles from database"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        response = supabase.table("articles").select("*").order("timestamp", desc=True).limit(limit).execute()
        articles = response.data
        
        result = []
        for i, article in enumerate(articles, 1):
            result.append(ArticleResponse(
                id=article['id'],
                title=article['title'],
                url=article['url'],
                date=article.get('date') or '',
                author=article.get('author') or '',
                timestamp=str(article.get('timestamp') or ''),
                summary=article.get('summary') or '',
                feed_name=article.get('feed_name') or '',
                tag=article.get('tag') or 'Unknown'
            ))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading articles: {str(e)}")

@app.get("/api/article/{article_id}/summary")
async def get_article_summary(article_id: int):
    """Get summary for a specific article"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        response = supabase.table("articles").select("summary").eq("id", article_id).execute()
        if response.data:
            return {"summary": response.data[0]['summary']}
        
        # Fallback to sequential index search if DB ID doesn't match
        all_articles = supabase.table("articles").select("id, summary").order("timestamp", desc=True).execute()
        if all_articles.data and 1 <= article_id <= len(all_articles.data):
            return {"summary": all_articles.data[article_id - 1]['summary']}
            
        raise HTTPException(status_code=404, detail="Article not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading article: {str(e)}")

@app.get("/api/feeds", response_model=List[FeedResponse])
async def get_feeds():
    """Get all RSS feeds from database"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        response = supabase.table("feeds").select("*").order("name").execute()
        feeds = response.data
        return [FeedResponse(id=f["id"], name=f["name"], url=f["url"]) for f in feeds]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading feeds: {str(e)}")

@app.post("/api/feeds")
async def add_feed(feed_request: FeedRequest):
    """Add a new RSS feed to database"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    name = feed_request.name if feed_request.name else feed_request.url
    
    # Validate RSS feed structure
    try:
        parsed_feed = feedparser.parse(feed_request.url)
        if parsed_feed.bozo:
            raise HTTPException(status_code=400, detail="Invalid RSS feed")
    except:
        raise HTTPException(status_code=400, detail="Cannot parse RSS feed")
        
    try:
        # Check duplicates
        existing = supabase.table("feeds").select("id").eq("url", feed_request.url).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Feed already exists")
            
        supabase.table("feeds").insert({"url": feed_request.url, "name": name}).execute()
        return {"message": f"Feed '{name}' added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.delete("/api/feeds/{feed_id}")
async def remove_feed(feed_id: int):
    """Remove an RSS feed from database and its associated articles"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        existing = supabase.table("feeds").select("name").eq("id", feed_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Feed not found")
            
        # Delete associated articles first
        supabase.table("articles").delete().eq("feed_id", feed_id).execute()
        
        # Then delete the feed
        supabase.table("feeds").delete().eq("id", feed_id).execute()
        return {"message": f"Feed '{existing.data[0]['name']}' and its articles removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.delete("/api/articles")
async def delete_all_articles():
    """Delete all loaded articles from the database"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        # Delete all articles (id not equal to -1)
        supabase.table("articles").delete().neq("id", -1).execute()
        return {"message": "All articles deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/api/process-feeds")
async def manual_process_feeds(background_tasks: BackgroundTasks, sync: bool = False):
    """Manually trigger feed processing. Use sync=true for Vercel Cron."""
    if sync:
        process_feeds_background()
        return {"message": "Feed processing completed"}
    else:
        background_tasks.add_task(process_feeds_background)
        return {"message": "Feed processing started"}

@app.post("/api/process-feed/{feed_id}")
async def process_single_feed(feed_id: int):
    """Process a single RSS feed synchronously by ID."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        new_count = process_single_feed_by_id(feed_id)
        return {"message": "Feed processing completed", "new_articles": new_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing feed: {str(e)}")


@app.post("/api/convert-url")
async def convert_url_to_did_you_know(request: ArticleURLRequest):
    article_text = fetch_article_text(request.url, max_text_length)

    if "could not be loaded" in article_text or "doesn't seem to have" in article_text:
        raise HTTPException(status_code=400, detail="Failed to extract readable content from the URL.")

    settings = default.copy()
    prompt = f"{article_text}\n\n{settings['dyk_prompt']}"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {default['api_key']}"
    }

    messages = [
        {"role": "system", "content": default['system']},
        {"role": "user", "content": prompt}
    ]

    data = {
        "model": default["model"],
        "messages": messages,
        "max_tokens": 200,
        "temperature": 0.7,
    }

    try:
        response = requests.post(
            f"{default['url']}/chat/completions",
            headers=headers,
            json=data,
            timeout=30
        )
        if response.status_code == 200:
            result = response.json()["choices"][0]["message"]["content"].strip()
            return {"did_you_know": result}
        else:
            raise HTTPException(status_code=500, detail="Failed to generate summary from LLM.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during LLM call: {str(e)}")

@app.on_event("startup")
async def startup_event():
    # Automatically process feeds in the background when running locally (not on Vercel)
    if not os.environ.get("VERCEL"):
        print("Local startup detected. Running feed processing in the background...")
        import threading
        thread = threading.Thread(target=process_feeds_background)
        thread.start()

