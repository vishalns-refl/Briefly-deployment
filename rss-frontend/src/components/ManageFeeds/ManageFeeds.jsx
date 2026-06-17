import React, { useEffect, useState } from 'react';
import { fetchFeeds, addFeed, deleteFeed, toggleFeedStatus } from '../../api';
import './ManageFeeds.css';

const ManageFeedsPage = () => {
  const [feeds, setFeeds] = useState([]);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [variant, setVariant] = useState('info');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeeds();
  }, []);

  const loadFeeds = async () => {
    try {
      setLoading(true);
      const res = await fetchFeeds();
      setFeeds(res.data);
    } catch (err) {
      setVariant('danger');
      setStatus('Failed to load feeds');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFeed = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setVariant('warning');
      setStatus('Please enter a valid RSS URL');
      return;
    }
    try {
      const res = await addFeed({ url, name });
      setVariant('success');
      setStatus(res.data.message);
      setUrl('');
      setName('');
      loadFeeds();
    } catch (err) {
      setVariant('danger');
      setStatus(err.response?.data?.detail || 'Failed to add feed');
    }
  };

  const handleDeleteFeed = async (id) => {
    if (!window.confirm('Are you sure you want to delete this feed?')) return;
    try {
      const res = await deleteFeed(id);
      setVariant('success');
      setStatus(res.data.message);
      loadFeeds();
    } catch (err) {
      setVariant('danger');
      setStatus(err.response?.data?.detail || 'Failed to delete feed');
    }
  };

  const handleToggleFeed = async (id, currentStatus) => {
    try {
      const res = await toggleFeedStatus(id, !currentStatus);
      setVariant('success');
      setStatus(res.data.message);
      loadFeeds();
    } catch (err) {
      setVariant('danger');
      setStatus(err.response?.data?.detail || 'Failed to update feed status');
    }
  };

  return (
    <div className="manage-wrapper">
      <h2>Manage RSS Feeds</h2>

      {status && (
        <div className={`status-message ${variant === 'success' ? 'success' : 'error'}`} role="alert">
          {status}
        </div>
      )}

      <form className="feed-form" onSubmit={handleAddFeed}>
        <input
          type="url"
          placeholder="RSS Feed URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Feed Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit">
          Add Feed
        </button>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table className="feed-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>#</th>
              <th>Name</th>
              <th>URL</th>
              <th style={{ width: '100px' }}>Status</th>
              <th style={{ width: '220px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center" style={{ padding: '36px' }}>
                  <div className="loading-spinner-container">
                    <div className="loading-spinner"></div>
                    <span style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>Loading feeds...</span>
                  </div>
                </td>
              </tr>
            ) : feeds.length > 0 ? (
              feeds.map((feed, index) => (
                <tr key={feed.id} className={feed.is_active ? '' : 'feed-paused'}>
                  <td>{index + 1}</td>
                  <td>{feed.name}</td>
                  <td>
                    <a href={feed.url} target="_blank" rel="noopener noreferrer">
                      {feed.url}
                    </a>
                  </td>
                  <td>
                    <span className={`status-badge ${feed.is_active ? 'active' : 'paused'}`}>
                      {feed.is_active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className={`status-btn ${feed.is_active ? 'pause-btn' : 'resume-btn'}`}
                        onClick={() => handleToggleFeed(feed.id, feed.is_active)}
                      >
                        {feed.is_active ? '⏸️ Pause' : '▶️ Resume'}
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteFeed(feed.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center" style={{ color: '#6B7280', padding: '24px' }}>No feeds available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageFeedsPage;
