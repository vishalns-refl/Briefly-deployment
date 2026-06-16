import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchArticles, didYouKnowContent, deleteAllArticles } from '../../api';
import { FaThList, FaThLarge } from 'react-icons/fa';
import './HomePage.css';

const HomePage = () => {
  const [articles, setArticles] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); 
  const [currentPage, setCurrentPage] = useState(1);
  const [dykContent, setDykContent] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  const [searchParams] = useSearchParams();
  const tagFilter = searchParams.get("tag"); // <-- Get tag from URL

  const itemsPerPage = 8;

  useEffect(() => {
    fetchArticles(40)
      .then(res => {
        let data = res.data;
        if (tagFilter) {
          data = data.filter(article => article.tag === tagFilter);
        }
        setArticles(data);
        console.log(data);
        setCurrentPage(1); // reset to page 1 when tag changes
      })
      .catch(err => console.error('Failed to load articles', err));
  }, [tagFilter]);

  const toggleView = () => {
    setViewMode(prev => (prev === 'grid' ? 'list' : 'grid'));
  };

  const paginatedArticles = articles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(articles.length / itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleContent = async (url, id) => {
    setLoadingId(id);
    try {
      const { data } = await didYouKnowContent(url);
      setDykContent(data.did_you_know);
      setShowModal(true);
    } catch (err) {
      console.error('Error fetching Did You Know content:', err);
      setDykContent('Failed to fetch Did You Know content.');
      setShowModal(true);
    } finally {
      setLoadingId(null);
    }
  };

  const getTagClass = (tag) => {
    if (!tag) return 'tag-unknown';
    const cleanTag = tag.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `tag-${cleanTag}`;
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete all cached articles? This cannot be undone.")) return;
    try {
      await deleteAllArticles();
      setArticles([]);
    } catch (err) {
      console.error("Failed to delete articles", err);
      alert("Failed to delete articles: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="container page-wrapper">
      <section className="toolbar" style={{ justifyContent: 'space-between' }}>
        <button
          className="btn-clear-articles"
          style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#F87171', padding: '10px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '0.85rem' }}
          onClick={handleDeleteAll}
        >
          🗑️ Clear All Articles
        </button>
        <button
          className={viewMode === 'list' ? 'active' : ''}
          onClick={toggleView}
          title="Toggle view"
        >
          {viewMode === 'list' ? <FaThLarge /> : <FaThList />}
        </button>
      </section>

      <h3 className="mb-4 text-light font-weight-bold" style={{ letterSpacing: '-0.02em' }}>
        {tagFilter ? `Showing ${tagFilter} Articles` : 'All Articles'}
      </h3>

      <div className={`row g-4 ${viewMode === 'grid' ? 'row-cols-1 row-cols-md-2 row-cols-lg-4' : 'row-cols-1'}`}>
        {paginatedArticles.map((article, idx) => (
          <div key={idx} className="col">
            <div className="article-card">
              <div className="article-body">
                {article.tag && (
                  <span className={`article-tag ${getTagClass(article.tag)}`}>
                    {article.tag}
                  </span>
                )}
                <h3>{article.title}</h3>
                <div className="meta">
                  <span>{article.feed_name || 'Unknown'}</span>
                  <span className="bullet">•</span>
                  <span>{new Date(article.date || article.published_at).toLocaleDateString()}</span>
                </div>
                <div className="summary">
                  {article.summary || 'No summary available.'}
                </div>
                <div className="actions">
                  <a href={article.url || article.link} target="_blank" rel="noreferrer">
                    Read More
                  </a>
                  <button
                    className="did-you-know"
                    onClick={() => handleContent(article.url || article.link, idx)}
                    disabled={loadingId === idx} 
                  >
                    {loadingId === idx ? (
                      <span className="spinner-border spinner-border-sm text-info" role="status" />
                    ) : (
                      'Did you know?'
                    )}
                  </button>                
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="pagination-controls">
          <ul className="pagination">
            {Array.from({ length: totalPages }).map((_, i) => (
              <li key={i} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                <button className="page-link" onClick={() => handlePageChange(i + 1)}>
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {showModal && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(3,7,18,0.8)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content modal-content-glass">
              <div className="modal-header">
                <h5 className="modal-title">💡 Did You Know?</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <p style={{ color: '#D1D5DB' }}>{dykContent}</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-secondary-outline" style={{ border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => setShowModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
