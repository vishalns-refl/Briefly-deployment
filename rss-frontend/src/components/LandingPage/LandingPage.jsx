import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFeeds, processFeed } from '../../api';
import './LandingPage.css';

const LandingPage = () => {
  const [feeds, setFeeds] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [currentFeed, setCurrentFeed] = useState(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [loadingFeeds, setLoadingFeeds] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFeeds()
      .then(res => {
        setFeeds(res.data);
        setLoadingFeeds(false);
      })
      .catch(err => {
        console.error('Failed to load feeds', err);
        setLoadingFeeds(false);
      });
  }, []);

  const handleSync = async () => {
    if (feeds.length === 0) return;
    
    setSyncing(true);
    setProgress(0);
    setLogs([]);
    
    let processedCount = 0;
    
    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i];
      setCurrentFeed(feed.name);
      setLogs(prev => [...prev, { text: `Connecting to ${feed.name}...`, type: 'info' }]);
      
      try {
        const response = await processFeed(feed.id);
        const newArticles = response.data.new_articles;
        
        setLogs(prev => [
          ...prev, 
          { text: `✓ ${feed.name}: Found ${newArticles} new article(s).`, type: 'success' }
        ]);
      } catch (err) {
        setLogs(prev => [
          ...prev, 
          { text: `✗ Failed to process ${feed.name}: ${err.response?.data?.detail || err.message}`, type: 'error' }
        ]);
      }
      
      processedCount++;
      setProgress(Math.round((processedCount / feeds.length) * 100));
    }
    
    setCurrentFeed('Completed');
    setLogs(prev => [...prev, { text: 'Sync complete! Loading dashboard...', type: 'info' }]);
    
    setTimeout(() => {
      navigate('/dashboard');
    }, 1500);
  };

  return (
    <div className="landing-wrapper">
      <div className="landing-card">
        <div className="landing-logo">Briefly</div>
        <div className="landing-subtitle">
          Your personalized, AI-powered newsletter generator. Summarizing the web's best technical content on-demand.
        </div>

        {loadingFeeds ? (
          <div className="text-center py-4">
            <span className="spinner-border text-primary" role="status" />
            <p className="mt-2 text-muted">Checking configured feeds...</p>
          </div>
        ) : (
          <div className="landing-content">
            {!syncing ? (
              <div className="landing-actions">
                <button 
                  className="btn-primary-gradient" 
                  onClick={handleSync}
                  disabled={feeds.length === 0}
                >
                  🚀 Fetch Latest Summaries ({feeds.length} Feeds)
                </button>
                <button 
                  className="btn-secondary-outline" 
                  onClick={() => navigate('/dashboard')}
                >
                  📖 View Existing Summaries
                </button>
                {feeds.length === 0 && (
                  <div className="alert alert-warning mt-3" role="alert">
                    You don't have any RSS feeds configured yet. 
                    <span 
                      style={{ textDecoration: 'underline', cursor: 'pointer', marginLeft: '5px', fontWeight: 'bold' }} 
                      onClick={() => navigate('/feeds')}
                    >
                      Add Feeds
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="sync-progress-box">
                <div className="sync-status-text">
                  <span>
                    {progress === 100 ? (
                      <span className="text-success">Finished Syncing</span>
                    ) : (
                      <>Syncing: <strong style={{ color: '#818CF8' }}>{currentFeed}</strong></>
                    )}
                  </span>
                  <span>{progress}%</span>
                </div>
                
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {progress === 100 && (
                  <div className="text-center sync-completed-animation">
                    🎉
                  </div>
                )}

                <div className="sync-log-title">Activity Logs</div>
                <div className="sync-logs">
                  {logs.map((log, index) => (
                    <div key={index} className={`sync-log-entry ${log.type}`}>
                      <span>{log.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="feature-grid">
          <div className="feature-item">
            <span className="feature-icon">⚡</span>
            <div>
              <div className="feature-title">On-Demand AI Power</div>
              <div className="feature-desc">Summarizes latest posts instantly. Zero compute wasted when idle.</div>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🛡️</span>
            <div>
              <div className="feature-title">Zero-Timeout Design</div>
              <div className="feature-desc">Fetches feed-by-feed to guarantee success within serverless limits.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
