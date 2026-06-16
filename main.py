import uvicorn
from api.index import app

if __name__ == "__main__":
    print("Starting local RSS Feed Summarizer Backend with Supabase integration...")
    print("API is serving at http://localhost:8000")
    uvicorn.run("api.index:app", host="0.0.0.0", port=8000, reload=True)