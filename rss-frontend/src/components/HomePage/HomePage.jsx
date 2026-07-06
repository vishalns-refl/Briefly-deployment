import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchArticles, didYouKnowContent, deleteAllArticles, generateNewsletter } from '../../api';
import { FaThList, FaThLarge, FaCopy, FaCheck } from 'react-icons/fa';
import './HomePage.css';

const HomePage = () => {
  const [articles, setArticles] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); 
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dykContent, setDykContent] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  
  // L&D Newsletter Curation States
  const [showLDOnly, setShowLDOnly] = useState(false);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [guidelines, setGuidelines] = useState('');
  const [newsletterDraft, setNewsletterDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  const handleCopy = (article, idx) => {
    const textToCopy = `${article.title}\n${article.summary || 'No summary available.'}\nSource: ${article.url || article.link}`;
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setCopiedId(idx);
        setTimeout(() => {
          setCopiedId(null);
        }, 2000);
      })
      .catch(err => console.error('Failed to copy', err));
  };
  
  const [searchParams] = useSearchParams();
  const tagFilter = searchParams.get("tag"); // <-- Get tag from URL

  const itemsPerPage = 8;

  useEffect(() => {
    setLoading(true);
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
      .catch(err => console.error('Failed to load articles', err))
      .finally(() => setLoading(false));
  }, [tagFilter]);

  const toggleView = () => {
    setViewMode(prev => (prev === 'grid' ? 'list' : 'grid'));
  };

  const filteredArticles = articles.filter(article => {
    if (showLDOnly) {
      return article.ld_score !== undefined && article.ld_score !== null && article.ld_score >= 7;
    }
    return true;
  });

  const paginatedArticles = filteredArticles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredArticles.length / itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const togglePin = (articleId, e) => {
    e.stopPropagation();
    if (pinnedIds.includes(articleId)) {
      setPinnedIds(prev => prev.filter(id => id !== articleId));
    } else {
      if (pinnedIds.length >= 5) {
        alert("You can select a maximum of 5 articles for the newsletter curation.");
        return;
      }
      setPinnedIds(prev => [...prev, articleId]);
    }
  };

  const handleGenerateNewsletter = async () => {
    setGenerating(true);
    setNewsletterDraft('');
    try {
      const { data } = await generateNewsletter(pinnedIds, guidelines);
      setNewsletterDraft(data.newsletter);
    } catch (err) {
      console.error("Failed to generate newsletter", err);
      alert("Failed to generate newsletter: " + (err.response?.data?.detail || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(newsletterDraft)
      .then(() => {
        setCopiedDraft(true);
        setTimeout(() => setCopiedDraft(false), 2000);
      })
      .catch(err => console.error("Failed to copy newsletter draft", err));
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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            className={`btn-ld-filter ${showLDOnly ? 'active' : ''}`}
            onClick={() => {
              setShowLDOnly(!showLDOnly);
              setCurrentPage(1);
            }}
          >
            🎯 L&D Recommended
          </button>
          <button
            className="btn-clear-articles"
            style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#F87171', padding: '10px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '0.85rem' }}
            onClick={handleDeleteAll}
          >
            🗑️ Clear All Articles
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {pinnedIds.length > 0 && (
            <button 
              className="btn-open-drawer" 
              onClick={() => setDrawerOpen(true)}
            >
              📌 Newsletter Builder ({pinnedIds.length}/5)
            </button>
          )}
          <button
            className={viewMode === 'list' ? 'active' : ''}
            onClick={toggleView}
            title="Toggle view"
          >
            {viewMode === 'list' ? <FaThLarge /> : <FaThList />}
          </button>
        </div>
      </section>

      <h3 className="mb-4 text-light font-weight-bold" style={{ letterSpacing: '-0.02em' }}>
        {showLDOnly ? '🎯 Recommended L&D Articles' : (tagFilter ? `Showing ${tagFilter} Articles` : 'All Articles')}
      </h3>

      {loading ? (
        <div className="homepage-loading-container">
          <div className="loading-spinner"></div>
          <p>Fetching technical feeds and compiling AI summaries...</p>
        </div>
      ) : (
        <>
          <div className={`row g-4 ${viewMode === 'grid' ? 'row-cols-1 row-cols-md-2 row-cols-lg-4' : 'row-cols-1'}`}>
            {paginatedArticles.map((article, idx) => (
              <div key={idx} className="col">
                <div className={`article-card ${viewMode === 'list' ? 'card-list' : 'card-grid'}`}>
                  <div className="card-top-actions">
                    <button 
                      className={`btn-pin-card ${pinnedIds.includes(article.id) ? 'pinned' : ''}`} 
                      onClick={(e) => togglePin(article.id, e)}
                      title={pinnedIds.includes(article.id) ? "Remove from Newsletter" : "Pin to Newsletter"}
                    >
                      {pinnedIds.includes(article.id) ? '📌 Pinned' : '➕ Pin'}
                    </button>
                    <button 
                      className="btn-copy-article" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(article, idx);
                      }}
                      title="Copy heading and summary"
                    >
                      {copiedId === idx ? <FaCheck style={{ color: '#10B981' }} /> : <FaCopy />}
                    </button>
                  </div>
                  {article.image_url && (
                    <div className="article-image-wrapper">
                      <img src={article.image_url} alt={article.title} className="article-thumbnail" loading="lazy" />
                    </div>
                  )}
                  <div className="article-body">
                    <div className="tags-container">
                      {article.tag && (
                        <span className={`article-tag ${getTagClass(article.tag)}`}>
                          {article.tag}
                        </span>
                      )}
                      {article.ld_tag && (
                        <span className="article-ld-tag">
                          🏷️ {article.ld_tag}
                        </span>
                      )}
                      {article.ld_score !== undefined && article.ld_score !== null && (
                        <span className={`ld-score-badge score-${article.ld_score >= 8 ? 'high' : (article.ld_score >= 5 ? 'medium' : 'low')}`}>
                          🎯 L&D: {article.ld_score}/10
                        </span>
                      )}
                    </div>
                    <h3>{article.title}</h3>
                    <div className="meta">
                      <span>{article.feed_name || 'Unknown'}</span>
                      <span className="bullet">•</span>
                      <span>{new Date(article.date || article.published_at).toLocaleDateString()}</span>
                    </div>
                    <div className="summary">
                      {article.summary || 'No summary available.'}
                    </div>
                    {article.ld_insight && (
                      <div className="ld-insight-box">
                        <strong>💡 L&D Insight:</strong> {article.ld_insight}
                      </div>
                    )}
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
        </>
      )}

      {/* Curation Drawer */}
      <div className={`curation-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h4>📌 Curate Newsletter</h4>
          <button className="btn-close-drawer" onClick={() => setDrawerOpen(false)}>&times;</button>
        </div>
        <div className="drawer-body">
          <p className="drawer-desc">Select 3 to 5 articles to build an AI-powered monthly L&D newsletter draft.</p>
          
          <div className="pinned-list">
            {pinnedIds.length === 0 ? (
              <div className="empty-pinned">No articles pinned yet. Pinned articles will appear here.</div>
            ) : (
              articles
                .filter(a => pinnedIds.includes(a.id))
                .map(a => (
                  <div key={a.id} className="pinned-item">
                    <span className="pinned-item-title">{a.title}</span>
                    <button className="btn-remove-pin" onClick={() => setPinnedIds(prev => prev.filter(id => id !== a.id))}>&times;</button>
                  </div>
                ))
            )}
          </div>
          
          <div className="form-group mt-3">
            <label className="text-light small font-weight-bold">Theme / Guidelines (Optional):</label>
            <textarea
              className="form-control text-light bg-dark border-secondary"
              placeholder="e.g. Focus on remote team leadership skills and virtual collaboration tools..."
              value={guidelines}
              onChange={(e) => setGuidelines(e.target.value)}
              rows={3}
            />
          </div>
          
          <button
            className="btn-generate-newsletter mt-3 w-100"
            disabled={pinnedIds.length < 3 || pinnedIds.length > 5 || generating}
            onClick={handleGenerateNewsletter}
          >
            {generating ? (
              <span>⏳ Generating Newsletter...</span>
            ) : (
              `✨ Generate L&D Newsletter (${pinnedIds.length}/5 Pinned)`
            )}
          </button>
          {pinnedIds.length < 3 && pinnedIds.length > 0 && (
            <div className="text-warning small mt-2 text-center">Please pin at least 3 articles to generate.</div>
          )}
          
          {newsletterDraft && (
            <div className="newsletter-output-box mt-4">
              <div className="output-header">
                <h5>📝 Generated Draft</h5>
                <button className="btn-copy-draft" onClick={handleCopyDraft}>
                  {copiedDraft ? 'Copied!' : 'Copy Draft'}
                </button>
              </div>
              <textarea
                className="newsletter-raw-textarea"
                readOnly
                value={newsletterDraft}
                rows={12}
              />
            </div>
          )}
        </div>
      </div>

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
