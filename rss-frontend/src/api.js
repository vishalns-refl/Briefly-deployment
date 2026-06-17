import axios from 'axios';

const getBaseURL = () => {
  let url = process.env.REACT_APP_API_BASE_URL;
  if (url) {
    if (!url.endsWith('/api') && !url.endsWith('/api/')) {
      url = url.replace(/\/+$/, '') + '/api';
    }
    return url;
  }
  
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000/api';
  }
  
  return '/api';
};

const API = axios.create({
    baseURL: getBaseURL(),
});

export const fetchArticles = (limit = 20) => API.get(`/articles?limit=${limit}`);
export const fetchSummary = (id) => API.get(`/article/${id}/summary`);
export const fetchFeeds = () => API.get('/feeds');
export const addFeed = (feed) => API.post('/feeds', feed);
export const deleteFeed = (id) => API.delete(`/feeds/${id}`);
export const toggleFeedStatus = (id, isActive) => API.put(`/feeds/${id}`, { is_active: isActive });
export const didYouKnowContent = (url) => API.post('/convert-url', {url});
export const processFeed = (id) => API.post(`/process-feed/${id}`);
export const deleteAllArticles = () => API.delete('/articles');
export const fetchUsageMetrics = () => API.get('/usage-metrics');


