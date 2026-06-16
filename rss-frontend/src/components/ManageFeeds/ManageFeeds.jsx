import React, { useEffect, useState } from 'react';
import { fetchFeeds, addFeed, deleteFeed } from '../../api';
import './ManageFeeds.css';

const ManageFeedsPage = () => {
  const [feeds, setFeeds] = useState([]);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [variant, setVariant] = useState('info');

  useEffect(() => {
    loadFeeds();
  }, []);

  const loadFeeds = async () => {
    try {
      const res = await fetchFeeds();
      setFeeds(res.data);
    } catch (err) {
      setVariant('danger');
      setStatus('Failed to load feeds');
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
              <th style={{ width: '120px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {feeds.length > 0 ? (
              feeds.map((feed, index) => (
                <tr key={feed.id}>
                  <td>{index + 1}</td>
                  <td>{feed.name}</td>
                  <td>
                    <a href={feed.url} target="_blank" rel="noopener noreferrer">
                      {feed.url}
                    </a>
                  </td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteFeed(feed.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center" style={{ color: '#6B7280', padding: '24px' }}>No feeds available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageFeedsPage;
